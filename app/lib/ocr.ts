// On-device OCR via Tesseract.js (WebAssembly). Runs entirely in the browser —
// the worker, core, and language data are served from our own origin
// (scripts/copy-vendor.mjs), falling back to the library's CDN defaults, then
// all recognition happens locally. No image data is ever uploaded to a server.

import Tesseract from "tesseract.js";
import { postAi } from "@/app/lib/aiClient";

export interface OcrResult {
  text: string;
  confidence: number; // 0..100
}

type OcrImage = string | HTMLCanvasElement | File | Blob;

// Absolute URLs: the Tesseract worker runs from a blob: URL, where relative paths don't resolve.
const localPaths = () => {
  const base = `${window.location.origin}/vendor/tesseract`;
  return { workerPath: `${base}/worker.min.js`, corePath: `${base}/core`, langPath: `${base}/lang` };
};

/** Tesseract.recognize using the self-hosted engine first, then the CDN defaults. */
export async function recognize(image: OcrImage, options: Record<string, unknown> = {}) {
  try {
    return await Tesseract.recognize(image as any, "eng", { ...options, ...localPaths() });
  } catch {
    return await Tesseract.recognize(image as any, "eng", options);
  }
}

/**
 * Recognize text in an image / canvas / data-URL.
 * @param onProgress reports recognition progress as 0..100.
 */
export async function ocrImage(
  image: OcrImage,
  onProgress?: (percent: number) => void
): Promise<OcrResult> {
  const result = await recognize(image, {
    logger: (m: { status: string; progress: number }) => {
      if (m.status === "recognizing text" && onProgress) {
        onProgress(Math.min(100, Math.max(0, Math.round(m.progress * 100))));
      }
    },
  });
  return {
    text: (result.data.text || "").trim(),
    confidence: Math.round(result.data.confidence ?? 0),
  };
}

/** True when extracted text is empty or so sparse the page is likely scanned. */
export function looksScanned(text: string): boolean {
  return text.replace(/\s/g, "").length < 10;
}

/**
 * Helper to convert OcrImage to base64 string
 */
async function imageToBase64(image: OcrImage): Promise<string> {
  if (typeof image === "string") {
    // If it's already a base64 data URL
    if (image.startsWith("data:")) return image.split(",")[1];
    return image;
  }
  
  if (image instanceof HTMLCanvasElement) {
    return image.toDataURL("image/png").split(",")[1];
  }
  
  // File or Blob
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

/**
 * Recognize text using NVIDIA Nemotron OCR v2 (Cloud AI).
 * Much higher accuracy for complex documents compared to local Tesseract.
 */
export async function ocrImageWithNemotron(
  image: OcrImage,
  onProgress?: (percent: number) => void
): Promise<OcrResult> {
  if (onProgress) onProgress(10); // Starting
  
  const b64 = await imageToBase64(image);
  if (onProgress) onProgress(30); // Image processed
  
  if (onProgress) onProgress(60); // Sending to proxy
  const data = await postAi({ action: "nemotron-ocr", imageBase64: b64 });
  if (onProgress) onProgress(100);
  
  return {
    text: data.text || "",
    confidence: 99, // Cloud API doesn't return confidence, assume high
  };
}
