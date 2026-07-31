import { NextResponse } from "next/server";
import http from "node:http";
import https from "node:https";
import { rateLimit, clientKey, ocrRules, chatRules } from "@/app/lib/rateLimit";
import { stripOuterFence, looksLikeRefusal } from "@/app/lib/ocrMarkdown";

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

// ── Document OCR (image → Markdown) ─────────────────────────────────────────
// Kimi Vision is the primary provider; the local Unlimited-OCR server is an
// optional fallback for self-hosters running the model. Output feeds
// parseMarkdownToDocxElements in pdfToDocx, so Structured mode must return
// GitHub-Flavored Markdown, not flat text.
type OcrMode = "structured" | "basic";

const OCR_PROMPTS: Record<OcrMode, string> = {
  structured:
    "You are an OCR engine. Transcribe this document page into clean GitHub-Flavored Markdown. " +
    "Preserve reading order. Use #/##/### for headings that are visually headings. Render every table " +
    "as a GFM pipe table with a header separator row, keeping all rows and columns. Use - or 1. for lists, " +
    "**bold** and *italic* where the text is styled, and $...$ for mathematical notation. Keep blank lines " +
    "between paragraphs. Do NOT wrap the whole answer in a code fence and do NOT add any commentary. " +
    "If the page is blank, output nothing. Output only the transcription.",
  basic:
    "You are an OCR engine. Transcribe all text from this image in natural reading order as plain text. " +
    "Preserve line breaks between lines and paragraphs. Do not add markdown, commentary, or code fences.",
};

function ocrModeFromBody(value: unknown): OcrMode {
  return value === "basic" ? "basic" : "structured";
}

/** Tag a thrown error with how many retries were already spent, so the
 *  catch-site logger can report an accurate count instead of assuming 0. */
function withRetries(error: Error, retries: number): Error {
  (error as Error & { retries?: number }).retries = retries;
  return error;
}

async function runKimiOcr(imageBase64: string, mode: OcrMode): Promise<{ text: string; retries: number }> {
  const apiKey = process.env.KIMI_API_KEY;
  if (!apiKey) throw new Error("KIMI_API_KEY is not set");
  const base = (process.env.KIMI_BASE_URL || "https://api.kimi.com/coding/v1").replace(/\/+$/, "");
  const model = process.env.KIMI_VISION_MODEL || "k3";

  const doFetch = () =>
    fetch(`${base}/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
        Accept: "application/json",
      },
      body: JSON.stringify({
        model,
        messages: [
          {
            role: "user",
            content: [
              { type: "text", text: OCR_PROMPTS[mode] },
              { type: "image_url", image_url: { url: `data:image/png;base64,${imageBase64}` } },
            ],
          },
        ],
        temperature: 1, // k3 is reasoning-only and rejects other values
        max_tokens: 8000,
        stream: false,
      }),
      signal: AbortSignal.timeout(90_000),
    });

  // One retry on network error / 5xx before the caller falls to the next provider.
  // Retry count is attached to thrown errors too (via withRetries) so the final
  // failure log still reports how many attempts were actually made.
  let res: Response | undefined;
  let retries = 0;
  for (let attempt = 0; attempt < 2; attempt++) {
    if (attempt > 0) retries++;
    try {
      res = await doFetch();
    } catch {
      if (attempt === 1) throw withRetries(new Error("Kimi is unreachable or timed out"), retries);
      continue;
    }
    if (res.ok) break;
    if (res.status < 500 || attempt === 1) {
      let detail = "";
      try {
        const errBody = await res.json();
        detail = String(errBody?.error?.message ?? errBody?.error ?? "").trim();
      } catch {
        /* non-JSON error body */
      }
      throw withRetries(
        new Error(detail ? `Kimi OCR failed (${res.status}): ${detail}` : `Kimi OCR failed (${res.status})`),
        retries
      );
    }
  }

  const data = await res!.json();
  return { text: String(data.choices?.[0]?.message?.content ?? ""), retries };
}

async function runLocalOcr(imageBase64: string): Promise<{ text: string; retries: number }> {
  const serverUrl = process.env.UNLIMITED_OCR_SERVER_URL || "http://127.0.0.1:10000";
  const apiKey = process.env.UNLIMITED_OCR_API_KEY || "";
  const headers: Record<string, string> = {};
  if (apiKey) headers["Authorization"] = `Bearer ${apiKey}`;

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
  // No retry logic on this path today — always 0. If retries are added here
  // later, thread the real count through instead of leaving this hardcoded.
  return { text: String(data.choices?.[0]?.message?.content ?? ""), retries: 0 };
}

/** Ordered provider chain. `provider`/OCR_PROVIDER pins it; otherwise Kimi first
 *  when configured, local model as a fallback for self-hosters. */
function resolveOcrChain(requested?: string): Array<"kimi" | "local"> {
  const pin = (requested || process.env.OCR_PROVIDER || "").trim().toLowerCase();
  if (pin === "kimi") return ["kimi"];
  if (pin === "local") return ["local"];

  const chain: Array<"kimi" | "local"> = [];
  if (process.env.KIMI_API_KEY) chain.push("kimi");
  chain.push("local"); // always a fallback target (may be offline in prod)
  return chain;
}

interface OcrAttemptLog {
  provider: "kimi" | "local";
  retries: number;
  latencyMs: number;
  outcome: "success" | "empty" | "error";
  /** Truncated Error.message only — never OCR text, image data, or the API key. */
  error?: string;
}

/** Operational log line: what happened, not what was in the document. Never
 *  include imageBase64, the transcribed text, or any API key/header here. */
function logOcrRequest(entry: {
  mode: OcrMode;
  requestedProvider: string;
  chain: string[];
  attempts: OcrAttemptLog[];
  outcome: "success" | "warning" | "failure";
  finalProvider?: string;
  warning?: string;
  totalLatencyMs: number;
}) {
  const line = JSON.stringify({ event: "ocr_request", ...entry });
  if (entry.outcome === "failure") console.error(line);
  else console.log(line);
}

async function runOcrChain(
  imageBase64: string,
  mode: OcrMode,
  requestedProvider?: string
): Promise<{ text: string; provider: string; warning?: string }> {
  const chain = resolveOcrChain(requestedProvider);
  const attempts: OcrAttemptLog[] = [];
  const startedAt = Date.now();
  // Surface the FIRST provider's failure, not the last. The chain always ends
  // with "local" as an optional fallback for self-hosters — when it isn't
  // running, its ECONNREFUSED is meaningless noise to a user relying on the
  // configured cloud provider. The first attempt is the one that was actually
  // supposed to work, so its error is the actionable one.
  let firstError: unknown;

  for (const provider of chain) {
    const attemptStart = Date.now();
    try {
      const { text: raw, retries } =
        provider === "kimi" ? await runKimiOcr(imageBase64, mode) : await runLocalOcr(imageBase64);
      const text = stripOuterFence(raw);
      const latencyMs = Date.now() - attemptStart;

      if (!text) {
        if (firstError === undefined) firstError = new Error(`${provider} returned no text`);
        attempts.push({ provider, retries, latencyMs, outcome: "empty" });
        continue; // empty → try the next provider rather than emit a blank doc
      }

      const warning = looksLikeRefusal(text)
        ? "The OCR model may have returned a refusal instead of a transcription — check the output."
        : undefined;
      attempts.push({ provider, retries, latencyMs, outcome: "success" });
      logOcrRequest({
        mode,
        requestedProvider: requestedProvider || "auto",
        chain,
        attempts,
        outcome: warning ? "warning" : "success",
        finalProvider: provider,
        warning,
        totalLatencyMs: Date.now() - startedAt,
      });
      return { text, provider, warning };
    } catch (err) {
      if (firstError === undefined) firstError = err;
      const message = err instanceof Error ? err.message : String(err);
      const retries = (err as { retries?: number })?.retries ?? 0;
      attempts.push({
        provider,
        retries,
        latencyMs: Date.now() - attemptStart,
        outcome: "error",
        error: message.slice(0, 300),
      });
    }
  }

  logOcrRequest({
    mode,
    requestedProvider: requestedProvider || "auto",
    chain,
    attempts,
    outcome: "failure",
    totalLatencyMs: Date.now() - startedAt,
  });
  throw firstError instanceof Error ? firstError : new Error("No OCR provider is available");
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

    const { action, prompt, systemPrompt, imageBase64, provider, mode } = body as Record<string, unknown>;
    if (typeof action !== "string") {
      return NextResponse.json({ error: "Missing action" }, { status: 400 });
    }

    // Rate-limit the actions that cost money (OCR + vision + chat). The health
    // check and anything else fall through untouched.
    const OCR_ACTIONS = new Set(["unlimited-ocr", "document-ocr", "ocr", "vision-ocr"]);
    if (OCR_ACTIONS.has(action) || action === "deepseek-chat") {
      const verdict = await rateLimit(clientKey(req), action === "deepseek-chat" ? chatRules() : ocrRules());
      if (!verdict.ok) {
        return NextResponse.json(
          {
            error: `Rate limit reached — try again in about ${verdict.retryAfterSeconds}s. For very large documents or higher limits, run self-hosted with your own key.`,
          },
          { status: 429, headers: { "Retry-After": String(verdict.retryAfterSeconds) } }
        );
      }
    }

    if (action === "unlimited-ocr" || action === "document-ocr" || action === "ocr") {
      if (typeof imageBase64 !== "string" || !imageBase64) {
        return NextResponse.json({ error: "Missing imageBase64" }, { status: 400 });
      }
      if (imageBase64.length > MAX_IMAGE_BASE64_LENGTH) {
        return NextResponse.json({ error: "Image is too large" }, { status: 413 });
      }

      const requestedProvider = typeof provider === "string" ? provider : undefined;
      try {
        const result = await runOcrChain(imageBase64, ocrModeFromBody(mode), requestedProvider);
        return NextResponse.json({
          text: result.text,
          provider: result.provider,
          mode: ocrModeFromBody(mode),
          ...(result.warning ? { warning: result.warning } : {}),
        });
      } catch (err: unknown) {
        const detail = err instanceof Error ? err.message : String(err);
        const code = (err as { code?: string })?.code || "";
        const unreachable =
          code === "ECONNREFUSED" ||
          code === "ECONNRESET" ||
          code === "ENOTFOUND" ||
          /ECONNREFUSED|ECONNRESET|ENOTFOUND|timed out|unreachable/i.test(detail);

        // Kimi not configured and the only remaining fallback (local server) is
        // down: tell the operator how to fix it rather than emit a bare 502.
        if (!process.env.KIMI_API_KEY && unreachable) {
          return NextResponse.json(
            {
              error: `No OCR provider is available. Set KIMI_API_KEY for cloud OCR, or start the local Unlimited-OCR server. (${detail})`,
            },
            { status: 503 }
          );
        }

        // runOcrChain already emitted a structured ocr_request failure log —
        // avoid a second, unstructured console.error for the same event.
        return NextResponse.json({ error: `OCR couldn't process this page: ${detail}` }, { status: 502 });
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

    if (action === "vision-ocr") {
      if (typeof imageBase64 !== "string" || !imageBase64) {
        return NextResponse.json({ error: "Missing imageBase64" }, { status: 400 });
      }
      if (imageBase64.length > MAX_IMAGE_BASE64_LENGTH) {
        return NextResponse.json({ error: "Image is too large" }, { status: 413 });
      }

      const apiKey = process.env.KIMI_API_KEY;
      if (!apiKey) {
        return NextResponse.json({ error: "Cloud OCR is not configured" }, { status: 503 });
      }
      const base = (process.env.KIMI_BASE_URL || "https://api.kimi.com/coding/v1").replace(/\/+$/, "");
      const model = process.env.KIMI_VISION_MODEL || "k3";

      let res: Response;
      try {
        res = await fetch(`${base}/chat/completions`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${apiKey}`,
            Accept: "application/json",
          },
          body: JSON.stringify({
            model,
            messages: [
              {
                role: "user",
                content: [
                  {
                    type: "text",
                    text: "Extract every table on this page as GitHub-flavored markdown tables. Preserve all rows and columns exactly as shown. Output only the markdown tables — no commentary, no code fences. If there are no tables, output nothing.",
                  },
                  { type: "image_url", image_url: { url: `data:image/png;base64,${imageBase64}` } },
                ],
              },
            ],
            // k3 is a reasoning-only model on this endpoint — it rejects any
            // temperature other than 1.
            temperature: 1,
            max_tokens: 4000,
            stream: false,
          }),
        });
      } catch (err) {
        return NextResponse.json({ error: "Kimi is unreachable" }, { status: 502 });
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
          { error: detail ? `Cloud OCR request failed (${res.status}): ${detail}` : `Cloud OCR request failed (${res.status})` },
          { status: 502 }
        );
      }

      const data = await res.json();
      const text = data.choices?.[0]?.message?.content ?? "";
      return NextResponse.json({ text: String(text).trim() });
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
