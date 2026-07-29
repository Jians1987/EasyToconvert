import { NextResponse } from "next/server";

const MAX_IMAGE_BASE64_LENGTH = 35_000_000;
const MAX_PROMPT_LENGTH = 50_000;
const MAX_SYSTEM_PROMPT_LENGTH = 4_000;

export const maxDuration = 120;

export async function POST(req: Request) {
  try {
    const contentLength = Number(req.headers.get("content-length") || 0);
    if (contentLength > MAX_IMAGE_BASE64_LENGTH + 100_000) {
      return NextResponse.json({ error: "Request payload is too large" }, { status: 413 });
    }

    const body: unknown = await req.json();
    if (!body || typeof body !== "object") {
      return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
    }

    const { action, prompt, systemPrompt, imageBase64 } = body as Record<string, unknown>;
    if (typeof action !== "string") {
      return NextResponse.json({ error: "Missing action" }, { status: 400 });
    }

    if (action === "nemotron-ocr") {
      if (typeof imageBase64 !== "string" || !imageBase64) {
        return NextResponse.json({ error: "Missing imageBase64" }, { status: 400 });
      }
      if (imageBase64.length > MAX_IMAGE_BASE64_LENGTH) {
        return NextResponse.json({ error: "Image is too large" }, { status: 413 });
      }

      const apiKey = process.env.NVIDIA_NEMOTRON_API_KEY;
      if (!apiKey) {
        return NextResponse.json({ error: "Cloud OCR is not configured" }, { status: 503 });
      }

      const res = await fetch("https://integrate.api.nvidia.com/v1/chat/completions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${apiKey}`,
          Accept: "application/json",
        },
        body: JSON.stringify({
          model: "nvidia/nemotron-parse",
          messages: [{ role: "user", content: [{ type: "image_url", image_url: { url: `data:image/png;base64,${imageBase64}` } }] }],
        }),
      });

      if (!res.ok) {
        return NextResponse.json({ error: `Cloud OCR request failed (${res.status})` }, { status: 502 });
      }

      const data = await res.json();
      let text = data.choices?.[0]?.message?.tool_calls?.[0]?.function?.arguments
        ?? data.choices?.[0]?.message?.content
        ?? "";
      try {
        const parsed = JSON.parse(text);
        if (typeof parsed === "string") text = parsed;
      } catch {}
      return NextResponse.json({ text: String(text).trim() });
    }

    if (action === "unlimited-ocr") {
      if (typeof imageBase64 !== "string" || !imageBase64) {
        return NextResponse.json({ error: "Missing imageBase64" }, { status: 400 });
      }
      if (imageBase64.length > MAX_IMAGE_BASE64_LENGTH) {
        return NextResponse.json({ error: "Image is too large" }, { status: 413 });
      }

      const serverUrl = process.env.UNLIMITED_OCR_SERVER_URL || "http://127.0.0.1:10000";
      const apiKey = process.env.UNLIMITED_OCR_API_KEY || "";

      try {
        const headers: Record<string, string> = {
          "Content-Type": "application/json",
          Accept: "application/json",
        };
        if (apiKey) {
          headers["Authorization"] = `Bearer ${apiKey}`;
        }

        let res: Response | null = null;
        let lastErr: unknown = null;
        for (let attempt = 1; attempt <= 2; attempt++) {
          try {
            res = await fetch(`${serverUrl}/v1/chat/completions`, {
              method: "POST",
              headers,
              signal: AbortSignal.timeout(120_000),
              body: JSON.stringify({
                model: "Unlimited-OCR",
                messages: [
                  {
                    role: "user",
                    content: [
                      { type: "text", text: "<image>document parsing." },
                      { type: "image_url", image_url: { url: `data:image/png;base64,${imageBase64}` } },
                    ],
                  },
                ],
                temperature: 0,
                skip_special_tokens: false,
                stream: false,
                images_config: { image_mode: "gundam" },
              }),
            });
            if (res) break;
          } catch (e) {
            lastErr = e;
            if (attempt < 2) await new Promise((r) => setTimeout(r, 500));
          }
        }
        if (!res) throw lastErr;

        if (!res.ok) {
          const errText = await res.text();
          return NextResponse.json(
            { error: `Unlimited-OCR Server Error (${res.status}): ${errText}` },
            { status: 502 }
          );
        }

        const data = await res.json();
        const text = data.choices?.[0]?.message?.content ?? "";
        return NextResponse.json({ text: String(text).trim() });
      } catch (err: unknown) {
        console.error("Unlimited-OCR endpoint fetch failed:", err);
        const detail = err instanceof Error ? err.message : String(err);
        return NextResponse.json(
          {
            error: `Unlimited-OCR server request failed (${detail}). Ensure python server.py (or start_server.bat) is running on ${serverUrl}.`,
          },
          { status: 503 }
        );
      }
    }

    if (action === "unlimited-ocr-status") {
      const serverUrl = process.env.UNLIMITED_OCR_SERVER_URL || "http://127.0.0.1:10000";
      try {
        const res = await fetch(`${serverUrl}/health`, { method: "GET", signal: AbortSignal.timeout(3000) });
        return NextResponse.json({ online: res.ok, status: res.status, serverUrl });
      } catch {
        return NextResponse.json({ online: false, status: 503, serverUrl });
      }
    }

    if (action === "deepseek-chat") {
      if (typeof prompt !== "string" || !prompt) {
        return NextResponse.json({ error: "Missing prompt" }, { status: 400 });
      }
      if (prompt.length > MAX_PROMPT_LENGTH) {
        return NextResponse.json({ error: "Prompt is too large" }, { status: 413 });
      }
      if (systemPrompt !== undefined && typeof systemPrompt !== "string") {
        return NextResponse.json({ error: "Invalid systemPrompt" }, { status: 400 });
      }
      if (typeof systemPrompt === "string" && systemPrompt.length > MAX_SYSTEM_PROMPT_LENGTH) {
        return NextResponse.json({ error: "System prompt is too large" }, { status: 413 });
      }

      const apiKey = process.env.NVIDIA_DEEPSEEK_API_KEY;
      if (!apiKey) {
        return NextResponse.json({ error: "AI tools are not configured" }, { status: 503 });
      }

      const messages: Array<{ role: "system" | "user"; content: string }> = [];
      if (typeof systemPrompt === "string" && systemPrompt) messages.push({ role: "system", content: systemPrompt });
      messages.push({ role: "user", content: prompt });

      const res = await fetch("https://integrate.api.nvidia.com/v1/chat/completions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${apiKey}`,
          Accept: "application/json",
        },
        body: JSON.stringify({
          model: "deepseek-ai/deepseek-v4-flash",
          messages,
          temperature: 0.7,
          top_p: 0.95,
          max_tokens: 4000,
          extra_body: { chat_template_kwargs: { thinking: true, reasoning_effort: "high" } },
          stream: false,
        }),
      });

      if (!res.ok) {
        return NextResponse.json({ error: `AI provider request failed (${res.status})` }, { status: 502 });
      }

      const data = await res.json();
      const message = data.choices?.[0]?.message ?? {};
      return NextResponse.json({
        content: String(message.content ?? "").trim(),
        reasoning: String(message.reasoning ?? message.reasoning_content ?? "").trim(),
      });
    }

    return NextResponse.json({ error: "Invalid action" }, { status: 400 });
  } catch (error: unknown) {
    console.error("AI Proxy Error:", error);
    const message = error instanceof SyntaxError ? "Invalid JSON body" : "Internal server error";
    return NextResponse.json({ error: message }, { status: error instanceof SyntaxError ? 400 : 500 });
  }
}
