export type ToolCategory = "PDF" | "Image" | "Developer" | "AI / Data" | "Media";
export interface Tool { id: string; name: string; category: ToolCategory; href: string; keywords: string; note?: string }
export const tools: Tool[] = [
  { id: "pdf-merge", name: "Merge PDF", category: "PDF", href: "/merge-pdf", keywords: "combine join" },
  { id: "pdf-split", name: "Split PDF", category: "PDF", href: "/split-pdf", keywords: "extract pages" },
  { id: "pdf-compress", name: "Compress PDF", category: "PDF", href: "/compress-pdf", keywords: "reduce shrink smaller size" },
  { id: "pdf-rotate", name: "Rotate PDF", category: "PDF", href: "/rotate-pdf", keywords: "orientation" },
  { id: "pdf-word", name: "PDF to Word", category: "PDF", href: "/pdf-to-word", keywords: "convert doc docx" },
  { id: "pdf-excel", name: "PDF to Excel", category: "PDF", href: "/pdf-to-excel", keywords: "xlsx spreadsheet table bank statement" },
  { id: "pdf-jpg", name: "PDF to JPG", category: "PDF", href: "/pdf-to-jpg", keywords: "image png pages" },
  { id: "pdf-edit", name: "Add Text to PDF", category: "PDF", href: "/add-text-to-pdf", keywords: "edit fill form type write annotate" },
  { id: "tables", name: "Table Detection", category: "PDF", href: "/table-detect", keywords: "extract tables tatr csv excel" },
  { id: "pdf-protect", name: "Protect / Lock PDF", category: "PDF", href: "/merge-pdf", keywords: "encrypt password", note: "Set an output password in the PDF merge tool; a single file works too." },
  { id: "image-compress", name: "Compress Image", category: "Image", href: "/compress-image", keywords: "reduce optimize jpg png kb" },
  { id: "image-resize", name: "Resize Image", category: "Image", href: "/resize-image", keywords: "dimensions width height pixels" },
  { id: "png-jpg", name: "PNG to JPG", category: "Image", href: "/png-to-jpg", keywords: "convert jpeg" },
  { id: "jpg-png", name: "JPG to PNG", category: "Image", href: "/jpg-to-png", keywords: "convert jpeg" },
  { id: "image-metadata", name: "View Image Metadata", category: "Image", href: "/image#metadata", keywords: "metadata exif", note: "View basic file metadata. Re-encode with Convert to WebP to strip embedded metadata." },
  { id: "svg-png", name: "SVG to PNG", category: "Image", href: "/svg-to-png", keywords: "vector raster" },
  { id: "webp", name: "Convert to WebP", category: "Image", href: "/image-to-webp", keywords: "jpg png webp image" },
  { id: "base64", name: "Base64 Encoder / Decoder", category: "Developer", href: "/base64-encode-decode", keywords: "encode decode" },
  { id: "url", name: "URL Encoder / Decoder", category: "Developer", href: "/url-encode-decode", keywords: "percent encode query string" },
  { id: "uuid", name: "UUID Generator", category: "Developer", href: "/uuid-generator", keywords: "guid random identifier" },
  { id: "qr", name: "QR Code Generator", category: "Developer", href: "/qr-code-generator", keywords: "barcode" },
  { id: "password", name: "Password Generator", category: "Developer", href: "/password-generator", keywords: "secure random" },
  { id: "minifiers", name: "JS / CSS / HTML Minifiers", category: "Developer", href: "/minify-js-css-html", keywords: "javascript compress code" },
  { id: "html-format", name: "HTML Formatter", category: "Developer", href: "/html-formatter", keywords: "beautify indent" },
  { id: "gradient", name: "CSS Gradient Generator", category: "Developer", href: "/css-gradient-generator", keywords: "background linear" },
  { id: "shadow", name: "Box Shadow Generator", category: "Developer", href: "/box-shadow-generator", keywords: "css shadow" },
  { id: "json-format", name: "JSON Format & Beautify", category: "AI / Data", href: "/json-formatter", keywords: "pretty print formatter validate" },
  { id: "json-minify", name: "JSON Minify", category: "AI / Data", href: "/json-formatter", keywords: "compact reduce whitespace" },
  { id: "csv-json", name: "Convert CSV / JSON", category: "AI / Data", href: "/csv-to-json", keywords: "spreadsheet data" },
  { id: "xml-json", name: "XML to JSON", category: "AI / Data", href: "/xml-to-json", keywords: "convert parse" },
  { id: "json-yaml", name: "JSON to YAML", category: "AI / Data", href: "/json-to-yaml", keywords: "yml config" },
  { id: "summarizer", name: "Document Summarizer", category: "AI / Data", href: "/summarize-pdf", keywords: "ai pdf summary", note: "Cloud AI: requires sending text to the server." },
  { id: "ocr", name: "OCR – Image to Text", category: "AI / Data", href: "/image-to-text", keywords: "image text recognition scan" },
  { id: "audio-compress", name: "Compress Audio", category: "Media", href: "/compress-audio", keywords: "mp3 wav bitrate" },
  { id: "video-mp3", name: "Video to MP3", category: "Media", href: "/video-to-mp3", keywords: "extract audio mp4 mov webm" },
  { id: "audio-trim", name: "Trim Audio", category: "Media", href: "/trim-audio", keywords: "cut mp3 ringtone clip" },
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
