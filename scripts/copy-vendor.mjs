// Copies the in-browser engines (PDF.js, FFmpeg core, Tesseract OCR) from
// node_modules into public/vendor so they are served from our own origin
// instead of third-party CDNs (which ad-blockers, firewalls and outages break).
import { cpSync, existsSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";

const root = join(dirname(new URL(import.meta.url).pathname), "..");
const out = join(root, "public", "vendor");

const files = [
  ["pdfjs-dist/build/pdf.min.js", "pdfjs/pdf.min.js"],
  ["pdfjs-dist/build/pdf.worker.min.js", "pdfjs/pdf.worker.min.js"],
  ["@ffmpeg/core/dist/umd/ffmpeg-core.js", "ffmpeg/ffmpeg-core.js"],
  ["@ffmpeg/core/dist/umd/ffmpeg-core.wasm", "ffmpeg/ffmpeg-core.wasm"],
  ["tesseract.js/dist/worker.min.js", "tesseract/worker.min.js"],
  ["@neslinesli93/qpdf-wasm/dist/qpdf.wasm", "qpdf/qpdf.wasm"],
  ["@tesseract.js-data/eng/4.0.0_best_int/eng.traineddata.gz", "tesseract/lang/eng.traineddata.gz"],
];
for (const core of ["tesseract-core", "tesseract-core-simd", "tesseract-core-lstm", "tesseract-core-simd-lstm"]) {
  files.push([`tesseract.js-core/${core}.wasm.js`, `tesseract/core/${core}.wasm.js`]);
}

for (const [from, to] of files) {
  const src = join(root, "node_modules", from);
  if (!existsSync(src)) {
    console.warn(`[copy-vendor] missing ${from}; the app will fall back to the CDN copy`);
    continue;
  }
  const dest = join(out, to);
  mkdirSync(dirname(dest), { recursive: true });
  cpSync(src, dest);
}
console.log(`[copy-vendor] engines copied to public/vendor`);
