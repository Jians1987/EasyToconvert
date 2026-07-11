"use client";

export interface PdfiumRenderedPage {
  page: number;
  width: number;
  height: number;
  originalWidth: number;
  originalHeight: number;
  canvas: HTMLCanvasElement;
  blob: Blob;
  url: string;
}

interface RenderPdfWithPdfiumOptions {
  password?: string;
  scale?: number;
  imageType?: "image/png" | "image/jpeg";
  quality?: number;
  onProgress?: (page: number, totalPages: number) => void;
}

let pdfiumLibraryPromise: Promise<any> | null = null;

async function getPdfiumLibrary() {
  if (!pdfiumLibraryPromise) {
    pdfiumLibraryPromise = import("@hyzyla/pdfium/browser/base64").then(({ PDFiumLibrary }) =>
      PDFiumLibrary.init()
    );
  }
  return pdfiumLibraryPromise;
}

function bitmapToCanvas(data: Uint8Array, width: number, height: number): HTMLCanvasElement {
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext("2d");
  if (!context) throw new Error("Canvas rendering is unavailable.");

  const imageData = context.createImageData(width, height);
  for (let source = 0, target = 0; source < data.length; source += 4, target += 4) {
    imageData.data[target] = data[source + 2];
    imageData.data[target + 1] = data[source + 1];
    imageData.data[target + 2] = data[source];
    imageData.data[target + 3] = data[source + 3];
  }
  context.putImageData(imageData, 0, 0);
  return canvas;
}

function canvasToBlob(canvas: HTMLCanvasElement, type: string, quality?: number): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error("Could not render PDF page image."))),
      type,
      quality
    );
  });
}

export async function renderPdfWithPdfium(
  file: File,
  {
    password,
    scale = 2,
    imageType = "image/png",
    quality,
    onProgress,
  }: RenderPdfWithPdfiumOptions = {}
): Promise<PdfiumRenderedPage[]> {
  const library = await getPdfiumLibrary();
  const document = await library.loadDocument(new Uint8Array(await file.arrayBuffer()), password);
  const totalPages = document.getPageCount();
  const pages: PdfiumRenderedPage[] = [];

  try {
    for (let index = 0; index < totalPages; index++) {
      const pageNumber = index + 1;
      onProgress?.(pageNumber, totalPages);
      const page = document.getPage(index);
      const rendered = await page.render({
        scale,
        render: "bitmap",
        colorSpace: "BGRA",
        renderFormFields: true,
      });
      const canvas = bitmapToCanvas(rendered.data, rendered.width, rendered.height);
      const blob = await canvasToBlob(canvas, imageType, quality);
      pages.push({
        page: pageNumber,
        width: rendered.width,
        height: rendered.height,
        originalWidth: rendered.originalWidth,
        originalHeight: rendered.originalHeight,
        canvas,
        blob,
        url: canvas.toDataURL(imageType, quality),
      });
    }
  } finally {
    document.destroy();
  }

  return pages;
}
