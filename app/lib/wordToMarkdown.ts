// Word (.docx) → Markdown, entirely in the browser.
//
// Pipeline: mammoth converts the .docx to clean semantic HTML (it reads the
// document's style map, so real Word headings/lists/tables/bold become the
// right HTML elements), then turndown + the GFM plugin turn that HTML into
// GitHub-Flavoured Markdown (including pipe tables and strikethrough, which
// plain turndown doesn't handle).
//
// Everything runs client-side — the file never leaves the device. The heavy
// libraries are dynamically imported so they stay out of SSR and the initial
// bundle, fetched only when a conversion actually runs.

export interface WordToMarkdownResult {
  markdown: string;
  /** Non-fatal notes from mammoth (unsupported styles, dropped elements). */
  warnings: string[];
  /** True when the source contained at least one image. */
  hadImages: boolean;
}

export interface WordToMarkdownOptions {
  /**
   * Inline images as base64 data URIs (self-contained but can be large). When
   * false, images are dropped and replaced by their alt text so the output
   * stays small and text-only. Default true.
   */
  embedImages?: boolean;
}

// CJS/ESM interop: dynamic import() of a CommonJS module puts the real export
// on `.default` under esModuleInterop, but some bundlers expose it directly.
// Resolve both shapes rather than guessing.
function interop<T>(mod: any): T {
  return (mod && mod.default) ?? mod;
}

/**
 * turndown-plugin-gfm only renders a `<table>` as a Markdown pipe table when its
 * first row is a header row (`<th>` cells). Word tables come out of mammoth as
 * all-`<td>` with no `<thead>`, so without this they'd be left as raw HTML.
 * Promote each header-less table's first row to `<th>` so it converts cleanly.
 */
function normalizeTablesForGfm(html: string): string {
  if (typeof DOMParser === "undefined") return html; // SSR guard (never hit client-side)
  const doc = new DOMParser().parseFromString(html, "text/html");
  doc.querySelectorAll("table").forEach((table) => {
    // mammoth wraps each cell's text in <p>. A paragraph is a block element, so
    // turndown surrounds it with newlines — and a newline inside a GFM cell
    // breaks the pipe table. Flatten every cell's paragraphs to inline content
    // (multiple paragraphs joined by <br>, which GFM renders as a line break).
    table.querySelectorAll("td, th").forEach((cell) => {
      const paragraphs = Array.from(cell.querySelectorAll(":scope > p"));
      if (paragraphs.length > 0) {
        cell.innerHTML = paragraphs.map((p) => p.innerHTML.trim()).join("<br>");
      }
    });
    // turndown-plugin-gfm only emits a pipe table when the first row is a header
    // (<th>). Word tables are all-<td>, so promote the first row's cells.
    if (!table.querySelector("th")) {
      const firstRow = table.querySelector("tr");
      firstRow?.querySelectorAll("td").forEach((td) => {
        const th = doc.createElement("th");
        th.innerHTML = td.innerHTML;
        td.replaceWith(th);
      });
    }
  });
  return doc.body.innerHTML;
}

/** Only the modern XML .docx is supported — the legacy binary .doc is not. */
export function isSupportedWordFile(file: File): boolean {
  const name = file.name.toLowerCase();
  if (name.endsWith(".docx")) return true;
  // Some browsers report this MIME even when the extension is missing.
  return file.type === "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
}

export async function convertDocxToMarkdown(
  file: File | ArrayBuffer,
  options: WordToMarkdownOptions = {}
): Promise<WordToMarkdownResult> {
  const { embedImages = true } = options;

  if (file instanceof File && !isSupportedWordFile(file)) {
    if (file.name.toLowerCase().endsWith(".doc")) {
      throw new Error(
        "The old .doc format isn't supported. Open it in Word and 'Save As' .docx, then try again."
      );
    }
    throw new Error("Please choose a Word .docx file.");
  }

  const arrayBuffer = file instanceof File ? await file.arrayBuffer() : file;

  const mammoth = interop<any>(await import("mammoth"));
  const TurndownService = interop<any>(await import("turndown"));
  const gfmMod = await import("turndown-plugin-gfm");
  const gfm = (gfmMod as any).gfm ?? (gfmMod as any).default?.gfm;

  // mammoth's default embeds images as base64 data URIs. To drop them, hand it a
  // converter that yields an <img> with no src, then strip those below.
  const convertImage = embedImages
    ? undefined
    : mammoth.images.imgElement(() => Promise.resolve({ src: "" }));

  const { value: html, messages } = await mammoth.convertToHtml(
    { arrayBuffer },
    convertImage ? { convertImage } : {}
  );

  const hadImages = /<img\b/i.test(html);
  // When not embedding, remove the emptied <img> tags so turndown doesn't emit
  // stray `![]()` references; the alt text (if any) is preserved by turndown
  // only when a src exists, so a small note is added in the UI instead.
  const withoutImages = embedImages ? html : html.replace(/<img\b[^>]*>/gi, "");
  const cleanedHtml = normalizeTablesForGfm(withoutImages);

  const turndown = new TurndownService({
    headingStyle: "atx", // "# Heading" rather than underlines
    hr: "---",
    bulletListMarker: "-",
    codeBlockStyle: "fenced",
    emDelimiter: "*",
    strongDelimiter: "**",
    linkStyle: "inlined",
  });
  turndown.use(gfm); // GFM tables, strikethrough, task lists

  const markdown = turndown.turndown(cleanedHtml).trim() + "\n";

  const warnings = messages
    .filter((m: any) => m.type === "warning" || m.type === "error")
    .map((m: any) => String(m.message));

  return { markdown, warnings, hadImages };
}
