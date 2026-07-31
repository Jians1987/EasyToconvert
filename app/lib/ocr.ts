// Document OCR client. Uploads an image to /api/ai, which runs the server-side
// provider chain (Kimi Vision by default, Mistral OCR available by explicit
// pin, the local Unlimited-OCR model as fallback) and returns recognised text
// — Markdown in structured mode, plain text in basic.
//
// NOTE: this is NOT on-device. Every function here uploads the image, so UI copy
// must not describe OCR as local. See app/api/ai/route.ts for the providers.

// The OCR endpoint returns recognised text only — no per-page confidence — so
// this deliberately has no confidence field rather than inventing a score.
export interface OcrResult {
  text: string;
  /** Which backend actually produced this result ("kimi" | "local" | "mistral"), when the server reports it. */
  provider?: string;
  /** Set when the response looked suspicious (e.g. a likely model refusal) — surface it, don't hide it. */
  warning?: string;
}

/** Human-readable label for a provider id returned by the OCR route. */
export function ocrProviderLabel(provider?: string): string {
  switch (provider) {
    case "kimi":
      return "Kimi Vision (Moonshot AI)";
    case "local":
      return "Unlimited-OCR (self-hosted)";
    case "mistral":
      return "Mistral OCR";
    default:
      return "Cloud OCR";
  }
}

type OcrImage = string | HTMLCanvasElement | File | Blob;

/** True when extracted text is empty or so sparse the page is likely scanned. */
export function looksScanned(text: string): boolean {
  return text.replace(/\s/g, "").length < 10;
}

/**
 * Helper to convert OcrImage to base64 string
 */
async function imageToBase64(image: OcrImage): Promise<string> {
  if (typeof image === "string") {
    if (image.startsWith("data:")) return image.split(",")[1];
    return image;
  }
  
  if (image instanceof HTMLCanvasElement) {
    // If canvas is exceptionally large (>2048px width/height), scale down to save bandwidth
    const maxDim = Math.max(image.width, image.height);
    if (maxDim > 2048) {
      const scale = 2048 / maxDim;
      const targetCanvas = document.createElement("canvas");
      targetCanvas.width = Math.round(image.width * scale);
      targetCanvas.height = Math.round(image.height * scale);
      const ctx = targetCanvas.getContext("2d");
      if (ctx) {
        ctx.fillStyle = "#ffffff";
        ctx.fillRect(0, 0, targetCanvas.width, targetCanvas.height);
        ctx.drawImage(image, 0, 0, targetCanvas.width, targetCanvas.height);
        return targetCanvas.toDataURL("image/jpeg", 0.92).split(",")[1];
      }
    }
    return image.toDataURL("image/jpeg", 0.92).split(",")[1];
  }
  
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      resolve(result.split(",")[1]);
    };
    reader.onerror = reject;
    reader.readAsDataURL(image as Blob);
  });
}

// "mistral" is reachable but not part of the server's default auto chain —
// see resolveOcrChain in app/lib/ocrProviderChain.ts for why.
export type OcrProvider = "auto" | "kimi" | "local" | "mistral";
export type OcrMode = "basic" | "structured";

export interface OcrParams {
  image: OcrImage;
  /** Which backend to use. "auto" (default) lets the server pick per its config. */
  provider?: OcrProvider;
  /** "structured" (default) returns Markdown; "basic" returns plain text. */
  mode?: OcrMode;
  onProgress?: (percent: number) => void;
}

/**
 * Run OCR on an image via the server-side provider chain. Structured mode
 * returns GitHub-Flavored Markdown (headings, tables, lists); basic mode returns
 * plain text. The image is uploaded to /api/ai — this is not on-device.
 */
export async function ocrImage(params: OcrParams): Promise<OcrResult> {
  const { image, provider = "auto", mode = "structured", onProgress } = params;

  onProgress?.(10);
  const b64 = await imageToBase64(image);
  onProgress?.(40);

  const res = await fetch("/api/ai", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ action: "document-ocr", imageBase64: b64, provider, mode }),
  });

  if (!res.ok) {
    let errMsg = `OCR request failed (${res.status})`;
    try {
      const errJson = await res.json();
      if (errJson.error) errMsg = errJson.error;
    } catch {
      const errText = await res.text().catch(() => "");
      if (errText) errMsg = errText;
    }
    console.error("OCR proxy failed:", errMsg);
    throw new Error(errMsg);
  }

  const data = await res.json();
  onProgress?.(100);
  return { text: data.text || "", provider: data.provider, warning: data.warning };
}

/**
 * Back-compat wrapper. The existing callers (pdfToDocx, tableExtractor, the AI
 * page, the PDF page) pass (image, onProgress) and expect structured Markdown,
 * so keep this thin delegate rather than changing all four call sites.
 */
export async function ocrImageWithUnlimitedOcr(
  image: OcrImage,
  onProgress?: (percent: number) => void
): Promise<OcrResult> {
  return ocrImage({ image, onProgress, provider: "auto", mode: "structured" });
}
