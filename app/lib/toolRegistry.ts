export type ToolCategory = "PDF" | "Image" | "Developer" | "AI / Data" | "Media";
export interface Tool { id: string; name: string; category: ToolCategory; href: string; keywords: string; note?: string }
export const tools: Tool[] = [
  { id: "pdf-merge", name: "Merge PDF", category: "PDF", href: "/pdf#merge", keywords: "combine join" },
  { id: "pdf-split", name: "Split PDF", category: "PDF", href: "/pdf#split", keywords: "extract pages" },
  { id: "pdf-rotate", name: "Rotate PDF", category: "PDF", href: "/pdf#rotate", keywords: "orientation" },
  { id: "pdf-word", name: "PDF to Word", category: "PDF", href: "/pdf#to-doc", keywords: "convert doc docx" },
  { id: "tables", name: "Table Detection", category: "PDF", href: "/table-detect", keywords: "extract tables tatr csv excel" },
  { id: "pdf-protect", name: "Protect / Lock PDF", category: "PDF", href: "/pdf#merge", keywords: "encrypt password", note: "Set an output password in the PDF merge tool; a single file works too." },
  { id: "image-compress", name: "Compress Image", category: "Image", href: "/image#compress", keywords: "reduce optimize jpg png" },
  { id: "image-resize", name: "Resize Image", category: "Image", href: "/image#resize", keywords: "dimensions width height" },
  { id: "image-metadata", name: "View Image Metadata", category: "Image", href: "/image#metadata", keywords: "metadata exif", note: "View basic file metadata. Re-encode with Convert to WebP to strip embedded metadata." },
  { id: "svg-png", name: "SVG to PNG", category: "Image", href: "/image#svg-png", keywords: "vector raster" },
  { id: "webp", name: "Convert to WebP", category: "Image", href: "/image#convert", keywords: "jpg png webp image" },
  { id: "base64", name: "Base64 Encoder / Decoder", category: "Developer", href: "/developer#base64", keywords: "encode decode" },
  { id: "uuid", name: "UUID Generator", category: "Developer", href: "/developer#uuid", keywords: "guid random identifier" },
  { id: "qr", name: "QR Code Generator", category: "Developer", href: "/developer#qrcode", keywords: "barcode" },
  { id: "password", name: "Password Generator", category: "Developer", href: "/developer#password", keywords: "secure random" },
  { id: "minifiers", name: "JS / CSS / HTML Minifiers", category: "Developer", href: "/javascript#minify", keywords: "javascript compress code" },
  { id: "json-format", name: "JSON Format & Beautify", category: "AI / Data", href: "/data#json-format", keywords: "pretty print formatter validate" },
  { id: "json-minify", name: "JSON Minify", category: "AI / Data", href: "/data#json-format", keywords: "compact reduce whitespace" },
  { id: "csv-json", name: "Convert CSV / JSON", category: "AI / Data", href: "/data#csv-json", keywords: "spreadsheet data" },
  { id: "json-yaml", name: "JSON to YAML", category: "AI / Data", href: "/data#json-yaml", keywords: "yml config" },
  { id: "summarizer", name: "Document Summarizer", category: "AI / Data", href: "/ai#summarize", keywords: "ai pdf summary", note: "Cloud AI: requires sending text to the server." },
  { id: "ocr", name: "OCR", category: "AI / Data", href: "/ai#ocr", keywords: "image text recognition scan" },
  { id: "media", name: "Compress Video / Audio", category: "Media", href: "/media#compress", keywords: "mp4 mp3 wav webm" },
];

// Token-wise subsequence matching supports abbreviations such as “jfmt” and “p d f”.
export function searchTools(query: string): Tool[] {
  const tokens = query.toLowerCase().trim().split(/\s+/).filter(Boolean);
  return tools.map((tool) => {
    const title = tool.name.toLowerCase();
    const haystack = `${title} ${tool.category.toLowerCase()} ${tool.keywords}`;
    let score = 0;
    for (const token of tokens) {
      if (title.includes(token)) { score += title.startsWith(token) ? 100 : 60; continue; }
      if (haystack.includes(token)) { score += 30; continue; }
      let cursor = 0;
      for (const char of title) if (char === token[cursor]) cursor++;
      if (cursor !== token.length) return { tool, score: -1 };
      score += 1;
    }
    return { tool, score };
  }).filter(({ score }) => score >= 0).sort((a, b) => b.score - a.score).map(({ tool }) => tool);
}

export type FileKind = "pdf" | "image" | "json" | "csv" | "media" | "unsupported";
export function detectFileKind(type: string, name = ""): FileKind {
  const mime = type.toLowerCase().split(";")[0];
  const ext = name.toLowerCase().split(".").pop();
  if (mime === "application/pdf" || ext === "pdf") return "pdf";
  if (["image/png", "image/jpeg", "image/webp", "image/gif", "image/bmp", "image/svg+xml", "image/avif"].includes(mime) || /^(png|jpe?g|webp|gif|bmp|svg|avif)$/.test(ext || "")) return "image";
  if (mime === "application/json" || ext === "json") return "json";
  if (mime === "text/csv" || ext === "csv") return "csv";
  if (/^(audio|video)\//.test(mime) || /^(mp4|webm|mov|mp3|wav|ogg|m4a)$/.test(ext || "")) return "media";
  return "unsupported";
}
