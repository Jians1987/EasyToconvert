"use client";

import { useRef, useState, type DragEvent } from "react";
import { useRouter } from "next/navigation";
import { detectFileKind, tools, type FileKind } from "@/app/lib/toolRegistry";
import { stageFile } from "@/app/lib/toolLaunch";

const suggestions: Record<FileKind, { id: string; label: string }[]> = {
  pdf: [{ id: "pdf-compress", label: "Compress PDF" }, { id: "pdf-word", label: "Convert to Word" }, { id: "tables", label: "Extract Tables (TATR)" }, { id: "pdf-protect", label: "Protect/Lock" }],
  image: [{ id: "webp", label: "Convert to WebP" }, { id: "image-compress", label: "Compress Image" }, { id: "image-metadata", label: "Remove/View Metadata" }, { id: "image-resize", label: "Resize" }],
  json: [{ id: "json-format", label: "Format & Beautify" }, { id: "csv-json", label: "Convert to CSV/JSON" }, { id: "json-minify", label: "Minify" }],
  csv: [{ id: "csv-json", label: "Format & Beautify" }, { id: "csv-json", label: "Convert to CSV/JSON" }, { id: "csv-json", label: "Minify" }],
  media: [{ id: "media", label: "Compress Video / Audio" }], unsupported: [],
};

export default function ConversionHero() {
  const input = useRef<HTMLInputElement>(null);
  const depth = useRef(0);
  const router = useRouter();
  const [file, setFile] = useState<File | null>(null);
  const [dragging, setDragging] = useState(false);
  const [preview, setPreview] = useState<FileKind | null>(null);
  const [notice, setNotice] = useState("");
  const kind = dragging ? preview : file ? detectFileKind(file.type, file.name) : null;
  const actions = kind ? suggestions[kind] : [];

  const choose = (files: FileList | null) => {
    if (!files?.length) return;
    setFile(files[0]);
    setNotice(files.length > 1 ? "One file at a time: selected the first file. Choose another file to replace it." : "");
  };
  const drag = (event: DragEvent) => {
    if (!Array.from(event.dataTransfer.types).includes("Files")) return;
    event.preventDefault();
    depth.current++;
    setDragging(true);
    const item = Array.from(event.dataTransfer.items).find((entry) => entry.kind === "file");
    const type = item ? detectFileKind(item.type) : "unsupported";
    setPreview(type === "unsupported" ? null : type);
  };

  return <section aria-label="Quick file conversion" className="mx-auto max-w-3xl space-y-4 px-1">
    <div onDragEnter={drag} onDragOver={(e) => { e.preventDefault(); e.dataTransfer.dropEffect = "copy"; }}
      onDragLeave={(e) => { e.preventDefault(); depth.current = Math.max(0, depth.current - 1); if (!depth.current) { setDragging(false); setPreview(null); } }}
      onDrop={(e) => { e.preventDefault(); depth.current = 0; setDragging(false); setPreview(null); choose(e.dataTransfer.files); }}
      className={`rounded-3xl border-2 border-dashed p-6 transition duration-200 motion-reduce:transition-none sm:p-10 ${dragging ? "border-indigo-500 bg-indigo-100 dark:bg-indigo-950/60" : "border-indigo-300 bg-white/70 dark:border-indigo-800 dark:bg-slate-900/70"}`}>
      <input ref={input} type="file" className="sr-only" tabIndex={-1} aria-label="Choose a file to convert" onChange={(e) => { choose(e.target.files); e.target.value = ""; }} />
      <button type="button" onClick={() => input.current?.click()} aria-describedby="hero-formats" className="w-full rounded-xl py-4 text-center focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-8 focus-visible:outline-indigo-500">
        <span aria-hidden="true" className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-indigo-100 text-3xl text-indigo-600 dark:bg-indigo-500/20 dark:text-indigo-300">↥</span>
        <span className="block text-lg font-semibold text-slate-900 dark:text-white sm:text-xl">Drop any file here to convert or optimize</span>
        <span className="mt-2 block text-sm text-indigo-600 dark:text-indigo-300">or browse files</span>
      </button>
      <p id="hero-formats" className="mt-3 text-center text-xs text-slate-500 dark:text-slate-400">PDF, PNG, JPG, WebP, JSON, CSV, MP4 and more · one file at a time</p>
    </div>
    <p className="text-center text-xs text-slate-600 dark:text-slate-400">🔒 100% Client-Side: File never leaves your machine</p>
    <div role="status" aria-live="polite" aria-atomic="true" className="text-center text-sm text-slate-600 dark:text-slate-300">
      {dragging ? preview ? `${preview.toUpperCase()} detected. Drop to choose an action.` : "Drop to identify the file and see available actions." : file && <span className="break-all">{file.name} · {(file.size / 1024).toFixed(1)} KB</span>}
      {kind === "unsupported" && <p className="mt-2">This file type isn’t supported yet. Try a PDF, image, JSON, CSV, or media file, or browse the tool categories below.</p>}
      {notice && <p className="mt-2">{notice}</p>}
    </div>
    {actions.length > 0 && <div key={kind} className="quick-actions grid grid-cols-1 gap-3 sm:grid-cols-2">
      {actions.map(({ id, label }, index) => <button key={`${id}-${index}`} type="button" disabled={dragging || !file}
        onClick={() => {
          if (!file) return;
          const tool = tools.find((entry) => entry.id === id);
          if (!tool) { setNotice("PDF compression is not available in this version yet. Try another PDF action."); return; }
          stageFile(file, tool.href);
          router.push(tool.href);
        }} className="rounded-xl border border-slate-200 bg-white px-4 py-4 text-left text-sm font-semibold text-slate-800 transition hover:border-indigo-500 hover:bg-indigo-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-indigo-500 disabled:opacity-60 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100 dark:hover:border-indigo-500 dark:hover:bg-indigo-950/50 motion-reduce:transition-none">
        {label}<span aria-hidden="true" className="float-right text-indigo-500">↗</span>
        {id === "pdf-compress" && <span className="mt-1 block text-xs font-normal text-slate-500 dark:text-slate-400">Coming soon</span>}
      </button>)}
    </div>}
    {kind === "csv" && <p className="text-center text-xs text-slate-500 dark:text-slate-400">Convert CSV to JSON first, then use the JSON formatter to beautify or minify.</p>}
    {kind === "image" && <p className="text-center text-xs text-slate-500 dark:text-slate-400">View basic metadata, or re-encode with WebP to remove embedded metadata.</p>}
    {file && <button type="button" onClick={() => { setFile(null); setNotice(""); }} className="mx-auto block rounded px-3 py-2 text-xs underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-indigo-500">Clear selected file</button>}
  </section>;
}
