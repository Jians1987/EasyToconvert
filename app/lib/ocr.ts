// On-device OCR via Tesseract.js (WebAssembly). Runs entirely in the browser —
// the worker, core, and language data are fetched from a CDN once, then all
// recognition happens locally. No image data is ever uploaded to a server.

import Tesseract from "tesseract.js";

export interface OcrResult {
  text: string;
  confidence: number; // 0..100
}

type OcrImage = string | HTMLCanvasElement | File | Blob;

/**
 * Recognize text in an image / canvas / data-URL.
 * @param onProgress reports recognition progress as 0..100.
 */
export async function ocrImage(
  image: OcrImage,
  onProgress?: (percent: number) => void
): Promise<OcrResult> {
  const result = await Tesseract.recognize(image as any, "eng", {
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
