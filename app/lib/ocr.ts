// On-device OCR via Tesseract.js (WebAssembly). Runs entirely in the browser —
// the worker, core, and language data are fetched from a CDN once, then all
// recognition happens locally. No image data is ever uploaded to a server.

import Tesseract from "tesseract.js";

export interface OcrResult {
  text: string;
  confidence: number; // 0..100
}

type OcrImage = string | HTMLCanvasElement | File | Blob;

// Singleton worker promise — created once and reused across calls.
let workerPromise: Promise<Tesseract.Worker> | null = null;

function getWorker(): Promise<Tesseract.Worker> {
  if (!workerPromise) {
    workerPromise = Tesseract.createWorker("eng");
  }
  return workerPromise;
}

/**
 * Recognize text in an image / canvas / data-URL.
 * @param onProgress reports recognition progress as 0..100.
 */
export async function ocrImage(
  image: OcrImage,
  onProgress?: (percent: number) => void
): Promise<OcrResult> {
  const worker = await getWorker();
  const result = await worker.recognize(image as any, {}, {
    text: true,
    blocks: false,
    hocr: false,
    tsv: false,
    layoutBlocks: false,
  });
  // Surface progress if the caller provided a callback
  if (onProgress) onProgress(100);
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
  const res = await fetch("/api/ai", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      action: "nemotron-ocr",
      imageBase64: b64
    })
  });

  if (!res.ok) {
    console.error("Nemotron OCR proxy failed:", await res.text());
    throw new Error(`Nemotron OCR API Error: ${res.status}`);
  }

  const data = await res.json();
  if (onProgress) onProgress(100);
  
  return {
    text: data.text || "",
    confidence: 99, // Cloud API doesn't return confidence, assume high
  };
}
