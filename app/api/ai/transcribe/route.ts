import { NextResponse } from "next/server";

// Groq doesn't publish a hard cap for /audio/transcriptions; this is a
// conservative safety limit so a huge upload fails fast with a clear message
// instead of tying up the function for the whole 120s budget.
const MAX_AUDIO_BYTES = 25 * 1024 * 1024;

export const maxDuration = 120;

export async function POST(req: Request) {
  try {
    const contentLength = Number(req.headers.get("content-length") || 0);
    if (contentLength > MAX_AUDIO_BYTES + 100_000) {
      return NextResponse.json({ error: "Audio file is too large (25MB limit)" }, { status: 413 });
    }

    const apiKey = process.env.GROQ_API_KEY;
    if (!apiKey) {
      return NextResponse.json({ error: "Transcription is not configured" }, { status: 503 });
    }

    let incomingForm: FormData;
    try {
      incomingForm = await req.formData();
    } catch {
      return NextResponse.json({ error: "Expected multipart/form-data with an audio file" }, { status: 400 });
    }

    const file = incomingForm.get("file");
    if (!(file instanceof Blob) || file.size === 0) {
      return NextResponse.json({ error: "Missing audio file" }, { status: 400 });
    }
    if (file.size > MAX_AUDIO_BYTES) {
      return NextResponse.json({ error: "Audio file is too large (25MB limit)" }, { status: 413 });
    }

    const language = incomingForm.get("language");
    const base = (process.env.GROQ_BASE_URL || "https://api.groq.com/openai/v1").replace(/\/+$/, "");
    const model = process.env.GROQ_WHISPER_MODEL || "whisper-large-v3-turbo";

    const upstreamForm = new FormData();
    upstreamForm.append("file", file, (file as any).name || "audio");
    upstreamForm.append("model", model);
    upstreamForm.append("response_format", "verbose_json");
    if (typeof language === "string" && language) upstreamForm.append("language", language);

    let res: Response;
    try {
      res = await fetch(`${base}/audio/transcriptions`, {
        method: "POST",
        headers: { Authorization: `Bearer ${apiKey}` },
        body: upstreamForm,
      });
    } catch {
      return NextResponse.json({ error: "Groq is unreachable" }, { status: 502 });
    }

    if (!res.ok) {
      let detail = "";
      try {
        const errBody = await res.json();
        detail = String(errBody?.error?.message ?? errBody?.error ?? "").trim();
      } catch {
        /* non-JSON error body */
      }
      return NextResponse.json(
        { error: detail ? `Transcription failed (${res.status}): ${detail}` : `Transcription failed (${res.status})` },
        { status: 502 }
      );
    }

    const data = await res.json();
    return NextResponse.json({
      text: String(data.text ?? "").trim(),
      language: data.language ?? null,
      duration: typeof data.duration === "number" ? data.duration : null,
      provider: "Groq",
      model,
    });
  } catch (error: unknown) {
    console.error("Transcription Proxy Error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
