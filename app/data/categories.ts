import {
  FileText,
  Image as ImageIcon,
  Database,
  Code,
  Sparkles,
  Video,
  Table2,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";

export interface ToolCategory {
  id: string;
  title: string;
  icon: LucideIcon;
  color: string;
  description: string;
  tools: string[];
  path: string;
}

export const CATEGORIES: ToolCategory[] = [
  {
    id: "pdf",
    title: "PDF Utilities",
    icon: FileText,
    color: "from-red-500/20 to-orange-500/20 text-red-500 border-red-500/30",
    description:
      "Merge, split, rotate, edit, and convert PDF files to Word, Excel, or JPG images directly in your browser.",
    tools: ["Merge PDF", "Split PDF", "PDF to Word", "PDF to Excel", "PDF Editor", "Protect PDF"],
    path: "/pdf",
  },
  {
    id: "image",
    title: "Image Studio",
    icon: ImageIcon,
    color: "from-blue-500/20 to-indigo-500/20 text-blue-500 border-blue-500/30",
    description:
      "Compress, resize, read metadata, and convert PNG to JPG, WebP, and SVG formats.",
    tools: ["PNG to JPG", "Compress Image", "Image Metadata", "Resize Image", "SVG to PNG"],
    path: "/image",
  },
  {
    id: "data",
    title: "Data Converters",
    icon: Database,
    color: "from-emerald-500/20 to-teal-500/20 text-emerald-500 border-emerald-500/30",
    description:
      "JSON formatting, minifying, validation, plus CSV, XML, and YAML conversion.",
    tools: ["JSON Formatter", "CSV to JSON", "XML to JSON", "JSON to YAML", "JSON Minifier"],
    path: "/data",
  },
  {
    id: "developer",
    title: "Developer Core",
    icon: Code,
    color: "from-purple-500/20 to-pink-500/20 text-purple-500 border-purple-500/30",
    description:
      "Base64 & URL encoding, UUID generators, password builders, and QR code makers.",
    tools: ["Base64 Encode", "URL Encoder", "UUID Generator", "QR Code", "Password Maker"],
    path: "/developer",
  },
  {
    id: "javascript",
    title: "JS & HTML/CSS",
    icon: Code,
    color: "from-amber-500/20 to-yellow-500/20 text-amber-500 border-amber-500/30",
    description:
      "Minify JS, HTML & CSS, beautify HTML, and generate CSS gradients and box shadows.",
    tools: ["JS Minifier", "HTML Beautifier", "CSS Minifier", "CSS Gradient Generator", "Box Shadow"],
    path: "/javascript",
  },
  {
    id: "ai",
    title: "AI Powerhouse",
    icon: Sparkles,
    color: "from-violet-500/20 to-fuchsia-500/20 text-violet-500 border-violet-500/30",
    description:
      "Extract text from scanned PDFs and images with on-device OCR, summarize documents, explain code, and translate text.",
    tools: ["AI Summarizer", "Image OCR", "AI Code Explainer", "Document Translator"],
    path: "/ai",
  },
  {
    id: "media",
    title: "Video & Audio",
    icon: Video,
    color: "from-cyan-500/20 to-sky-500/20 text-cyan-500 border-cyan-500/30",
    description:
      "Compress audio, extract MP3 from video, and trim clips locally with FFmpeg WebAssembly.",
    tools: ["Compress Audio", "Extract Audio", "Audio Cutter"],
    path: "/media",
  },
  {
    id: "table-detect",
    title: "Table Detection",
    icon: Table2,
    color: "from-rose-500/20 to-pink-500/20 text-rose-500 border-rose-500/30",
    description:
      "Research-grade AI table detection powered by Microsoft Table Transformer (TATR). Locate tables in any PDF or image, extract rows & columns, export to CSV / JSON / Excel — 100% on-device.",
    tools: ["Table Detector", "Structure Recognition", "CSV Export", "Excel Export", "JSON Export"],
    path: "/table-detect",
  },
];
