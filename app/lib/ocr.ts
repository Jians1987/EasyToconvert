// Unlimited OCR (Baidu Inc.) — State-of-the-art vision-language document parsing model.
// Replaces legacy Tesseract engine for all OCR operations in EasyToconvert.

export interface OcrResult {
  text: string;
  confidence: number; // 0..100
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

/**
 * Recognize text using Baidu Unlimited-OCR model.
 * State-of-the-art multi-page & structural document parsing model (Markdown, LaTeX, Tables).
 */
export async function ocrImageWithUnlimitedOcr(
  image: OcrImage,
  onProgress?: (percent: number) => void
): Promise<OcrResult> {
  if (onProgress) onProgress(10);

  const b64 = await imageToBase64(image);
  if (onProgress) onProgress(30);

  if (onProgress) onProgress(60);
  const res = await fetch("/api/ai", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      action: "unlimited-ocr",
      imageBase64: b64,
    }),
  });

  if (!res.ok) {
    let errMsg = `Unlimited OCR Error (${res.status})`;
    try {
      const errJson = await res.json();
      if (errJson.error) errMsg = errJson.error;
    } catch {
      const errText = await res.text().catch(() => "");
      if (errText) errMsg = errText;
    }
    console.error("Unlimited OCR proxy failed:", errMsg);
    throw new Error(errMsg);
  }

  const data = await res.json();
  if (onProgress) onProgress(100);

  return {
    text: data.text || "",
    confidence: 99,
  };
}

/**
 * Main OCR entry point for EasyToconvert.
 * Uses Baidu Unlimited-OCR engine by default.
 */
export async function ocrImage(
  image: OcrImage,
  onProgress?: (percent: number) => void
): Promise<OcrResult> {
  return ocrImageWithUnlimitedOcr(image, onProgress);
}
