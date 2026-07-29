import { NextResponse } from "next/server";
import http from "node:http";
import https from "node:https";

function postJsonNative(
  urlStr: string,
  payload: object,
  extraHeaders: Record<string, string> = {},
  timeoutMs = 180_000
): Promise<any> {
  return new Promise((resolve, reject) => {
    const url = new URL(urlStr);
    const postData = JSON.stringify(payload);
    const isHttps = url.protocol === "https:";
    const client = isHttps ? https : http;

    const req = client.request(
      {
        hostname: url.hostname,
        port: url.port || (isHttps ? 443 : 80),
        path: url.pathname + url.search,
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Content-Length": Buffer.byteLength(postData),
          Connection: "close",
          ...extraHeaders,
        },
        timeout: timeoutMs,
      },
      (res) => {
        let data = "";
        res.setEncoding("utf8");
        res.on("data", (chunk) => (data += chunk));
        res.on("end", () => {
          if (res.statusCode && res.statusCode >= 200 && res.statusCode < 300) {
            try {
              resolve(JSON.parse(data));
            } catch (e) {
              reject(new Error(`Invalid JSON response: ${data.slice(0, 200)}`));
            }
          } else {
            // Surface the server's own error message when it sends a JSON body
            // like {"error": "..."} instead of dumping the raw payload.
            let serverMsg = data.slice(0, 300);
            try {
              const parsed = JSON.parse(data);
              if (parsed && typeof parsed.error === "string" && parsed.error.trim()) {
                serverMsg = parsed.error.trim();
              }
            } catch {
              /* body wasn't JSON — keep the raw slice */
            }
            const httpErr = new Error(serverMsg) as Error & { statusCode?: number };
            httpErr.statusCode = res.statusCode;
            reject(httpErr);
          }
        });
      }
    );

    req.on("error", (err) => reject(err));
    req.on("timeout", () => {
      req.destroy();
      reject(new Error(`Unlimited-OCR request timed out after ${Math.round(timeoutMs / 1000)} seconds`));
    });

    req.write(postData);
    req.end();
  });
}

const MAX_IMAGE_BASE64_LENGTH = 35_000_000;
const MAX_PROMPT_LENGTH = 50_000;
const MAX_SYSTEM_PROMPT_LENGTH = 4_000;

/**
 * Chat providers for the AI productivity tools (summarizer, code explainer,
 * translator). Both speak the OpenAI `/chat/completions` shape, so switching is
 * a matter of base URL + model + key.
 *
 * Order: whichever key is present wins; when both are set, Groq goes first
 * (free tier, much faster) and NVIDIA is used as automatic fallback on rate
 * limits or provider outages. Pin the order with AI_PROVIDER=groq|nvidia.
 */
type ChatProvider = {
  id: "groq" | "nvidia";
  label: string;
  url: string;
  apiKey: string;
  model: string;
  /** Provider-specific fields merged into the request body. */
  extraBody?: Record<string, unknown>;
};

function resolveChatProviders(): ChatProvider[] {
  const providers: ChatProvider[] = [];

  const groqKey = process.env.GROQ_API_KEY;
  if (groqKey) {
    const base = (process.env.GROQ_BASE_URL || "https://api.groq.com/openai/v1").replace(/\/+$/, "");
    providers.push({
      id: "groq",
      label: "Groq",
      url: `${base}/chat/completions`,
      apiKey: groqKey,
      model: process.env.GROQ_MODEL || "llama-3.3-70b-versatile",
    });
  }

  const nvidiaKey = process.env.NVIDIA_DEEPSEEK_API_KEY;
  if (nvidiaKey) {
    providers.push({
      id: "nvidia",
      label: "DeepSeek",
      url: "https://integrate.api.nvidia.com/v1/chat/completions",
      apiKey: nvidiaKey,
      model: process.env.NVIDIA_DEEPSEEK_MODEL || "deepseek-ai/deepseek-v4-flash",
      extraBody: { extra_body: { chat_template_kwargs: { thinking: true, reasoning_effort: "high" } } },
    });
  }

  const preferred = process.env.AI_PROVIDER?.trim().toLowerCase();
  if (preferred) {
    providers.sort((a, b) => Number(b.id === preferred) - Number(a.id === preferred));
  }
  return providers;
}

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
        const headers: Record<string, string> = {};
        if (apiKey) {
          headers["Authorization"] = `Bearer ${apiKey}`;
        }

        const data = await postJsonNative(
          `${serverUrl}/v1/chat/completions`,
          {
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
          },
          headers,
          180_000
        );

        const text = data.choices?.[0]?.message?.content ?? "";
        return NextResponse.json({ text: String(text).trim() });
      } catch (err: unknown) {
        console.error("Unlimited-OCR endpoint fetch failed:", err);
        const detail = err instanceof Error ? err.message : String(err);
        const code = (err as { code?: string })?.code || "";
        const statusCode = (err as { statusCode?: number })?.statusCode;

        // Case 1: the server never answered — not running / wrong URL / still loading the model.
        const unreachable =
          statusCode === undefined &&
          (code === "ECONNREFUSED" ||
            code === "ECONNRESET" ||
            code === "ENOTFOUND" ||
            /ECONNREFUSED|ECONNRESET|ENOTFOUND|timed out/i.test(detail));

        if (unreachable) {
          return NextResponse.json(
            {
              error: `Can't reach the Unlimited-OCR server at ${serverUrl}. Start it with start_server.bat (or python server.py) and wait until it finishes loading the model, then try again. (${detail})`,
            },
            { status: 503 }
          );
        }

        // Case 2: the server answered but failed to process the page — show its real error.
        return NextResponse.json(
          {
            error: `Unlimited-OCR couldn't process this page: ${detail}`,
          },
          { status: 502 }
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

      const providers = resolveChatProviders();
      if (providers.length === 0) {
        return NextResponse.json({ error: "AI tools are not configured" }, { status: 503 });
      }

      const messages: Array<{ role: "system" | "user"; content: string }> = [];
      if (typeof systemPrompt === "string" && systemPrompt) messages.push({ role: "system", content: systemPrompt });
      messages.push({ role: "user", content: prompt });

      let lastError = "AI provider request failed";
      for (const provider of providers) {
        let res: Response;
        try {
          res = await fetch(provider.url, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${provider.apiKey}`,
              Accept: "application/json",
            },
            body: JSON.stringify({
              model: provider.model,
              messages,
              temperature: 0.7,
              top_p: 0.95,
              max_tokens: 4000,
              stream: false,
              ...provider.extraBody,
            }),
          });
        } catch (err) {
          lastError = `${provider.label} is unreachable`;
          continue; // network failure — try the next provider
        }

        if (!res.ok) {
          // Providers return {"error": {"message": "..."}}; surface it so a bad
          // key or a decommissioned model name is obvious instead of a bare 502.
          let detail = "";
          try {
            const errBody = await res.json();
            detail = String(errBody?.error?.message ?? errBody?.error ?? "").trim();
          } catch {
            /* non-JSON error body — the status code is all we have */
          }
          lastError = detail
            ? `${provider.label} request failed (${res.status}): ${detail}`
            : `${provider.label} request failed (${res.status})`;
          continue; // rate-limited or erroring — fall back to the next provider
        }

        const data = await res.json();
        const message = data.choices?.[0]?.message ?? {};
        return NextResponse.json({
          content: String(message.content ?? "").trim(),
          reasoning: String(message.reasoning ?? message.reasoning_content ?? "").trim(),
          provider: provider.label,
          model: provider.model,
        });
      }

      return NextResponse.json({ error: lastError }, { status: 502 });
    }

    return NextResponse.json({ error: "Invalid action" }, { status: 400 });
  } catch (error: unknown) {
    console.error("AI Proxy Error:", error);
    const message = error instanceof SyntaxError ? "Invalid JSON body" : "Internal server error";
    return NextResponse.json({ error: message }, { status: error instanceof SyntaxError ? 400 : 500 });
  }
}
