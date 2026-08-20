"use client";

import React, { useCallback, useState } from "react";
import ToolLayout from "@/components/ToolLayout";
import Dropzone from "@/components/Dropzone";
import { useConversions } from "@/app/providers";
import { convertDocxToMarkdown } from "@/app/lib/wordToMarkdown";
import {
  FileText,
  Download,
  Copy,
  Check,
  AlertTriangle,
  Loader2,
  Star,
  ImageOff,
  Images,
} from "lucide-react";

export default function WordToMarkdownPage() {
  const { addHistoryItem, favorites, toggleFavorite } = useConversions();
  const isPinned = favorites.includes("word-to-markdown");

  const [file, setFile] = useState<File | null>(null);
  const [markdown, setMarkdown] = useState("");
  const [warnings, setWarnings] = useState<string[]>([]);
  const [imageNote, setImageNote] = useState(false);
  const [embedImages, setEmbedImages] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const runConversion = useCallback(
    async (f: File, embed: boolean) => {
      setBusy(true);
      setError(null);
      setMarkdown("");
      setWarnings([]);
      setImageNote(false);
      try {
        const result = await convertDocxToMarkdown(f, { embedImages: embed });
        setMarkdown(result.markdown);
        setWarnings(result.warnings);
        setImageNote(result.hadImages && !embed);
        addHistoryItem({
          fileName: f.name,
          fileSize: f.size,
          toolType: "word-to-markdown",
          status: "success",
        });
      } catch (e) {
        setError(e instanceof Error ? e.message : "Conversion failed.");
        addHistoryItem({
          fileName: f.name,
          fileSize: f.size,
          toolType: "word-to-markdown",
          status: "failed",
        });
      } finally {
        setBusy(false);
      }
    },
    [addHistoryItem]
  );

  const handleFileSelected = useCallback(
    (files: File[]) => {
      if (!files.length) return;
      const f = files[0];
      setFile(f);
      runConversion(f, embedImages);
    },
    [embedImages, runConversion]
  );

  // Re-run when the image toggle changes and a file is already loaded.
  const handleToggleImages = (next: boolean) => {
    setEmbedImages(next);
    if (file) runConversion(file, next);
  };

  const handleCopy = async () => {
    if (!markdown) return;
    try {
      await navigator.clipboard.writeText(markdown);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      setError("Couldn't copy to clipboard.");
    }
  };

  const handleDownload = () => {
    if (!markdown) return;
    const blob = new Blob([markdown], { type: "text/markdown;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = (file?.name.replace(/\.docx$/i, "") || "document") + ".md";
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  };

  return (
    <ToolLayout
      title="Word to Markdown Converter"
      description="Turn a Word .docx file into clean GitHub-Flavoured Markdown — headings, lists, tables, links, and formatting preserved. Everything runs in your browser; your file never leaves your device."
      category="developer"
    >
      <div className="space-y-5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-sm font-semibold text-slate-700 dark:text-slate-200">
            <FileText className="w-4 h-4 text-indigo-500" />
            <span>DOCX → Markdown</span>
          </div>
          <button
            type="button"
            onClick={() => toggleFavorite("word-to-markdown")}
            className="flex items-center gap-1.5 text-xs font-medium text-slate-500 hover:text-amber-500 transition-colors"
            aria-pressed={isPinned}
          >
            <Star className={`w-4 h-4 ${isPinned ? "fill-amber-400 text-amber-400" : ""}`} />
            {isPinned ? "Pinned" : "Pin tool"}
          </button>
        </div>

        <Dropzone
          onFilesSelected={handleFileSelected}
          accept=".docx,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
          multiple={false}
          maxSizeMB={25}
          title="Drop a Word .docx file"
          description="or click to browse — converts instantly, on your device"
        />

        {/* Options */}
        <div className="flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={() => handleToggleImages(!embedImages)}
            className={`inline-flex items-center gap-2 rounded-lg px-3 py-1.5 text-xs font-semibold border transition-colors ${
              embedImages
                ? "border-indigo-500/40 bg-indigo-50/60 text-indigo-700 dark:bg-indigo-950/30 dark:text-indigo-300"
                : "border-slate-200 bg-slate-50 text-slate-600 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-300"
            }`}
          >
            {embedImages ? <Images className="w-3.5 h-3.5" /> : <ImageOff className="w-3.5 h-3.5" />}
            {embedImages ? "Images embedded (base64)" : "Images removed"}
          </button>
          <span className="text-[11px] text-slate-400">
            {embedImages
              ? "Output is self-contained but larger. Turn off for a smaller, text-only .md."
              : "Images are stripped for a smaller, text-only file."}
          </span>
        </div>

        {busy && (
          <div className="flex items-center gap-2 text-sm text-slate-500">
            <Loader2 className="w-4 h-4 animate-spin" />
            Converting {file?.name}…
          </div>
        )}

        {error && (
          <div className="p-3 rounded-xl border border-red-200 dark:border-red-900/50 bg-red-50 dark:bg-red-950/20 flex items-start gap-2.5 text-xs text-red-600 dark:text-red-400">
            <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {imageNote && (
          <div className="p-3 rounded-xl border border-amber-500/30 bg-amber-50/60 dark:bg-amber-950/20 text-[11px] text-amber-700 dark:text-amber-400">
            This document contained images, which were removed. Turn image embedding back on to keep them.
          </div>
        )}

        {warnings.length > 0 && (
          <details className="text-[11px] text-slate-500">
            <summary className="cursor-pointer font-semibold">
              {warnings.length} formatting note{warnings.length > 1 ? "s" : ""} (click to view)
            </summary>
            <ul className="mt-2 space-y-1 list-disc pl-5">
              {warnings.slice(0, 20).map((w, i) => (
                <li key={i}>{w}</li>
              ))}
            </ul>
          </details>
        )}

        {markdown && (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <label className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">
                Markdown Output
              </label>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleCopy}
                  className="inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors"
                >
                  {copied ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />}
                  {copied ? "Copied" : "Copy"}
                </button>
                <button
                  type="button"
                  onClick={handleDownload}
                  className="inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold bg-indigo-600 text-white hover:bg-indigo-700 transition-colors"
                >
                  <Download className="w-3.5 h-3.5" />
                  Download .md
                </button>
              </div>
            </div>
            <textarea
              value={markdown}
              onChange={(e) => setMarkdown(e.target.value)}
              spellCheck={false}
              className="w-full h-96 font-mono text-xs leading-relaxed p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/60 dark:bg-slate-950/40 text-slate-800 dark:text-slate-200 resize-y focus:outline-none focus:ring-2 focus:ring-indigo-500/40"
            />
          </div>
        )}
      </div>
    </ToolLayout>
  );
}
