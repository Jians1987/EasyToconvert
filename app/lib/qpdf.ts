// Unlocks encrypted PDFs in the browser with qpdf (WebAssembly). pdf-lib can't
// decrypt, so without this, merging or splitting any encrypted PDF fails —
// including the very common "owner password only" PDFs (bank statements,
// e-tickets) that open without a password but carry permission restrictions.
// The wasm is served from our own origin (scripts/copy-vendor.mjs) with a CDN fallback.

const WASM_SOURCES = [
  "/vendor/qpdf/qpdf.wasm",
  "https://cdn.jsdelivr.net/npm/@neslinesli93/qpdf-wasm@0.3.0/dist/qpdf.wasm",
];

interface QpdfInstance {
  callMain: (args: string[]) => number;
  FS: { writeFile: (path: string, data: Uint8Array) => void; readFile: (path: string) => Uint8Array };
}
type CreateModule = (options: Record<string, unknown>) => Promise<QpdfInstance>;

let wasmUrl: Promise<string> | null = null;

// This qpdf build only supports `locateFile`, so find a source that responds and
// point the engine at it (the browser cache serves the second request).
function findWasm(): Promise<string> {
  if (!wasmUrl) {
    wasmUrl = (async () => {
      for (const url of WASM_SOURCES) {
        try {
          if ((await fetch(url, { method: "HEAD" })).ok) return url;
        } catch {
          // try the next source
        }
      }
      throw new Error("Couldn't load the PDF unlocking engine. Check your connection and try again.");
    })().catch((e) => {
      wasmUrl = null; // allow a retry later
      throw e;
    });
  }
  return wasmUrl;
}

/**
 * Returns a decrypted copy of `bytes`, or null when the PDF needs a password to
 * open and `password` is missing or wrong. Owner-password-only PDFs unlock with
 * an empty password.
 */
export async function unlockPdf(bytes: Uint8Array, password = ""): Promise<Uint8Array | null> {
  const [{ default: createModule }, url] = await Promise.all([
    import("@neslinesli93/qpdf-wasm") as unknown as Promise<{ default: CreateModule }>,
    findWasm(),
  ]);
  // A fresh instance per call: qpdf's main() isn't designed to be re-entered.
  const qpdf = await createModule({ locateFile: () => url, noInitialRun: true, print: () => {}, printErr: () => {} });
  qpdf.FS.writeFile("/in.pdf", bytes);
  let code: number;
  try {
    code = qpdf.callMain(["--decrypt", `--password=${password}`, "/in.pdf", "/out.pdf"]);
  } catch (e) {
    code = (e as { status?: number }).status ?? 2;
  }
  // qpdf exit codes: 0 = success, 3 = success with warnings, 2 = error (e.g. invalid password).
  if (code !== 0 && code !== 3) return null;
  return qpdf.FS.readFile("/out.pdf");
}
