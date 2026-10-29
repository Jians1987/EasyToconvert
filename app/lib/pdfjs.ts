// Shared PDF.js loader. Serves the engine from our own origin (copied into
// public/vendor by scripts/copy-vendor.mjs) and falls back to the CDN only if
// the local copy is unavailable. The promise is cached so concurrent callers
// share a single <script> tag.

const VERSION = "3.11.174";
const SOURCES = [
  "/vendor/pdfjs",
  `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${VERSION}`,
];

let pending: Promise<any> | null = null;

function inject(base: string): Promise<any> {
  return new Promise((resolve, reject) => {
    const script = document.createElement("script");
    script.src = `${base}/pdf.min.js`;
    script.onload = () => {
      const lib = (window as any).pdfjsLib;
      if (!lib) return reject(new Error("PDF.js did not initialise."));
      lib.GlobalWorkerOptions.workerSrc = `${base}/pdf.worker.min.js`;
      resolve(lib);
    };
    script.onerror = () => { script.remove(); reject(new Error(`Failed to load PDF.js from ${base}`)); };
    document.head.appendChild(script);
  });
}

export function loadPdfJs(): Promise<any> {
  if (typeof window !== "undefined" && (window as any).pdfjsLib) return Promise.resolve((window as any).pdfjsLib);
  if (!pending) {
    pending = SOURCES.reduce<Promise<any>>(
      (attempt, base) => attempt.catch(() => inject(base)),
      Promise.reject(new Error("start")),
    ).catch(() => {
      pending = null; // allow a retry on the next call (e.g. after reconnecting)
      throw new Error("Failed to load the PDF engine. Check your connection and try again.");
    });
  }
  return pending;
}
