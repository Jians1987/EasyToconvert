// Slim index of the dedicated tool pages, safe to import into client components
// (navigation, sidebars, home page). Page copy lives in toolPages.ts (server only).

export type Hub = "pdf" | "image" | "data" | "developer" | "javascript" | "ai" | "media";

export const toolLinks = [
  { slug: "merge-pdf", hub: "pdf", mode: "merge", name: "Merge PDF" },
  { slug: "split-pdf", hub: "pdf", mode: "split", name: "Split PDF" },
  { slug: "compress-pdf", hub: "pdf", mode: "compress", name: "Compress PDF" },
  { slug: "pdf-to-word", hub: "pdf", mode: "to-doc", name: "PDF to Word" },
  { slug: "pdf-to-excel", hub: "pdf", mode: "to-excel", name: "PDF to Excel" },
  { slug: "pdf-to-jpg", hub: "pdf", mode: "to-image", name: "PDF to JPG" },
  { slug: "rotate-pdf", hub: "pdf", mode: "rotate", name: "Rotate PDF" },
  { slug: "add-text-to-pdf", hub: "pdf", mode: "edit", name: "Add Text to PDF" },
  { slug: "compress-image", hub: "image", mode: "compress", name: "Compress Image" },
  { slug: "resize-image", hub: "image", mode: "resize", name: "Resize Image" },
  { slug: "png-to-jpg", hub: "image", mode: "to-jpg", name: "PNG to JPG" },
  { slug: "jpg-to-png", hub: "image", mode: "to-png", name: "JPG to PNG" },
  { slug: "image-to-webp", hub: "image", mode: "convert", name: "Image to WebP" },
  { slug: "svg-to-png", hub: "image", mode: "svg-png", name: "SVG to PNG" },
  { slug: "json-formatter", hub: "data", mode: "json-format", name: "JSON Formatter" },
  { slug: "csv-to-json", hub: "data", mode: "csv-json", name: "CSV to JSON" },
  { slug: "xml-to-json", hub: "data", mode: "xml-json", name: "XML to JSON" },
  { slug: "json-to-yaml", hub: "data", mode: "json-yaml", name: "JSON to YAML" },
  { slug: "base64-encode-decode", hub: "developer", mode: "base64", name: "Base64 Encoder / Decoder" },
  { slug: "url-encode-decode", hub: "developer", mode: "url", name: "URL Encoder / Decoder" },
  { slug: "uuid-generator", hub: "developer", mode: "uuid", name: "UUID Generator" },
  { slug: "password-generator", hub: "developer", mode: "password", name: "Password Generator" },
  { slug: "qr-code-generator", hub: "developer", mode: "qrcode", name: "QR Code Generator" },
  { slug: "minify-js-css-html", hub: "javascript", mode: "minify", name: "JS / CSS / HTML Minifier" },
  { slug: "html-formatter", hub: "javascript", mode: "html-beautify", name: "HTML Formatter" },
  { slug: "css-gradient-generator", hub: "javascript", mode: "gradient", name: "CSS Gradient Generator" },
  { slug: "box-shadow-generator", hub: "javascript", mode: "shadow", name: "Box Shadow Generator" },
  { slug: "image-to-text", hub: "ai", mode: "ocr", name: "Image to Text (OCR)" },
  { slug: "summarize-pdf", hub: "ai", mode: "summarize", name: "PDF Summarizer" },
  { slug: "compress-audio", hub: "media", mode: "compress", name: "Compress Audio" },
  { slug: "video-to-mp3", hub: "media", mode: "extract", name: "Video to MP3" },
  { slug: "trim-audio", hub: "media", mode: "audio-trim", name: "Trim Audio" },
] as const satisfies readonly { slug: string; hub: Hub; mode: string; name: string }[];

export type ToolLink = (typeof toolLinks)[number];
export type ToolSlug = ToolLink["slug"];

export const toolLinksForHub = (hub: string) => toolLinks.filter((t) => t.hub === hub);
