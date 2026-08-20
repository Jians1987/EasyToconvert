// Single shared PDF.js loader for the whole app.
//
// Previously every consumer (pdf/PageClient, ai/PageClient, table-detect,
// pdfToDocx, pdfToXlsx, pdfTextExtractor) injected its own <script> tag pulling
// pdf.js 3.11.174 from cdnjs at runtime. That meant: an extra network round trip
// on every PDF action, a hard dependency on a third-party CDN being reachable
// (breaks on locked-down networks and contradicts the app's on-device promise),
// and a version frozen two majors behind.
//
// Now pdf.js 4.x is bundled from node_modules via a dynamic import — fetched
// only when a PDF operation actually runs (kept out of SSR and the initial
// bundle), served entirely from our own origin. v4 improves text-layer
// extraction, table structure, and font handling, which lifts fidelity across
// PDF→Word, PDF→Excel, table detection, and OCR at once.
//
// The worker is served from /public/pdf.worker.min.mjs (kept in sync with the
// installed pdfjs-dist version by the predev/prebuild "sync-pdf-worker" script).
// Serving it as a same-origin static file avoids webpack worker-chunking and
// import.meta.url rewriting entirely — the exact class of bug that broke
// onnxruntime-web in table-detect.

// pdfjs-dist ships its own types, but the dynamic import is typed `any` here so
// the six existing call sites keep working unchanged (they use getDocument,
// getPage, getTextContent, getViewport, render — the stable v3→v4 subset).
let cached: Promise<any> | null = null;

export function loadPdfJs(): Promise<any> {
  if (cached) return cached;
  cached = (async () => {
    const pdfjs = await import("pdfjs-dist");
    // pdf.worker.min.mjs is an ES module. Handed only a `workerSrc` string,
    // pdf.js v4 spawns a *classic* Worker, which chokes on the file's `export`
    // syntax ("Unexpected token 'export'"). Constructing the Worker ourselves
    // with { type: "module" } and passing it as workerPort forces a module
    // worker. pdf.js caches by port and multiplexes every document over this
    // one worker, so a single shared instance is correct (and is the pattern
    // bundler integrations use). Same-origin from /public — no CDN.
    pdfjs.GlobalWorkerOptions.workerPort = new Worker("/pdf.worker.min.mjs", { type: "module" });
    return pdfjs;
  })();
  return cached;
}
