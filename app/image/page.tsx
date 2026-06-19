"use client";

import React, { useState } from "react";
import ToolLayout from "@/components/ToolLayout";
import Dropzone from "@/components/Dropzone";
import { useConversions } from "@/app/providers";
import { Image as ImageIcon, Star } from "lucide-react";

type ImageMode = "convert" | "compress" | "resize" | "metadata";

export default function ImageTools() {
  const [mode, setMode] = useState<ImageMode>("convert");
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [processing, setProcessing] = useState(false);
  const [targetFormat, setTargetFormat] = useState("image/webp");
  const [quality, setQuality] = useState(80); // 1-100
  const [resizeWidth, setResizeWidth] = useState(800);
  const [resizeHeight, setResizeHeight] = useState(600);
  const [maintainAspect, setMaintainAspect] = useState(true);
  const [originalDimensions, setOriginalDimensions] = useState<{w: number, h: number} | null>(null);
  const [metadata, setMetadata] = useState<{ [key: string]: string } | null>(null);
  const [downloadUrl, setDownloadUrl] = useState<string | null>(null);
  const { addHistoryItem, favorites, toggleFavorite } = useConversions();

  const handleFilesSelected = (files: File[]) => {
    setSelectedFiles(files);
    setDownloadUrl(null);
    setMetadata(null);

    // Read metadata and original dimensions
    if (files.length > 0) {
      const file = files[0];
      setMetadata({
        "File Name": file.name,
        "File Size": (file.size / 1024).toFixed(1) + " KB",
        "Mime Type": file.type,
        "Last Modified": new Date(file.lastModified).toLocaleDateString(),
      });

      // Read original image dimensions
      const imgEl = new window.Image();
      imgEl.onload = () => {
        setOriginalDimensions({ w: imgEl.width, h: imgEl.height });
        setResizeWidth(imgEl.width);
        setResizeHeight(imgEl.height);
        URL.revokeObjectURL(imgEl.src);
      };
      imgEl.src = URL.createObjectURL(file);
    }
  };

  const processImage = async () => {
    if (selectedFiles.length === 0) return;
    setProcessing(true);
    setDownloadUrl(null);

    const file = selectedFiles[0];
    const reader = new FileReader();

    reader.onload = (e) => {
      const img = new window.Image();
      img.onload = () => {
        const canvas = document.createElement("canvas");
        const ctx = canvas.getContext("2d");

        let w = img.width;
        let h = img.height;

        if (mode === "resize") {
          w = resizeWidth;
          h = resizeHeight;
        }

        canvas.width = w;
        canvas.height = h;

        if (ctx) {
          ctx.drawImage(img, 0, 0, w, h);

          // Get image formats and compressions
          const mime = mode === "convert" ? targetFormat : file.type;
          const q = quality / 100;

          const dataUrl = canvas.toDataURL(mime, q);
          setDownloadUrl(dataUrl);

          // Parse estimated size
          const strLength = dataUrl.length - (dataUrl.indexOf(',') + 1);
          const estSize = Math.round(strLength * 3 / 4);

          addHistoryItem({
            fileName: `processed_${file.name.split(".")[0]}.${mime.split("/")[1]}`,
            fileSize: estSize,
            toolType: `image-${mode}`,
            status: "success",
            downloadUrl: dataUrl,
          });
        }
        setProcessing(false);
      };
      img.src = e.target?.result as string;
    };
    reader.readAsDataURL(file);
  };

  const isPinned = favorites.includes("image-tools");

  return (
    <ToolLayout
      title="Image Studio Tools"
      description="Compress file sizes, resize dimensions, read metadata, and convert formats (PNG, JPG, WebP) in bulk completely client-side."
      category="image"
    >
      <div className="space-y-6">
        {/* Header Tabs */}
        <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
          <div className="flex space-x-2">
            {(["convert", "compress", "resize", "metadata"] as const).map((t) => (
              <button
                key={t}
                onClick={() => {
                  setMode(t);
                  setDownloadUrl(null);
                }}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold capitalize transition-all ${
                  mode === t
                    ? "bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900"
                    : "text-slate-500 hover:text-slate-800 dark:hover:text-slate-200"
                }`}
              >
                {t}
              </button>
            ))}
          </div>

          <button
            onClick={() => toggleFavorite("image-tools")}
            className={`p-1.5 rounded-lg border transition-all ${
              isPinned
                ? "border-amber-200/50 bg-amber-500/10 text-amber-500"
                : "border-slate-200 dark:border-slate-800 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
            }`}
            title={isPinned ? "Unpin tool" : "Pin tool"}
          >
            <Star className={`w-4 h-4 ${isPinned ? "fill-amber-500" : ""}`} />
          </button>
        </div>

        {/* Dropzone */}
        <Dropzone
          onFilesSelected={handleFilesSelected}
          accept="image/*"
          multiple={false}
          maxSizeMB={25}
          title="Drag & drop your image file here"
        />

        {/* Configurations */}
        {selectedFiles.length > 0 && (
          <div className="space-y-4 pt-2">
            {mode === "convert" && (
              <div className="space-y-1.5 max-w-xs">
                <label className="text-[10px] uppercase font-bold text-slate-400">Target Image Format</label>
                <select
                  className="w-full glass-input text-xs"
                  value={targetFormat}
                  onChange={(e) => setTargetFormat(e.target.value)}
                >
                  <option value="image/webp">WebP (.webp)</option>
                  <option value="image/png">PNG (.png)</option>
                  <option value="image/jpeg">JPG / JPEG (.jpg)</option>
                </select>
              </div>
            )}

            {mode === "compress" && (
              <div className="space-y-2.5 max-w-xs">
                <div className="flex justify-between items-center">
                  <label className="text-[10px] uppercase font-bold text-slate-400">Compression Quality</label>
                  <span className="text-xs text-indigo-500 font-bold">{quality}%</span>
                </div>
                <input
                  type="range"
                  min="1"
                  max="100"
                  className="w-full h-1.5 bg-slate-200 dark:bg-slate-800 rounded-lg appearance-none cursor-pointer accent-indigo-500"
                  value={quality}
                  onChange={(e) => setQuality(Number(e.target.value))}
                />
              </div>
            )}

            {mode === "resize" && (
              <div className="space-y-3 max-w-xs">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <label className="text-[10px] uppercase font-bold text-slate-400">Width (px)</label>
                    <input
                      type="number"
                      className="w-full glass-input text-xs"
                      value={resizeWidth}
                      onChange={(e) => {
                        const newW = Number(e.target.value);
                        setResizeWidth(newW);
                        if (maintainAspect && originalDimensions && originalDimensions.w > 0) {
                          setResizeHeight(Math.round(newW * (originalDimensions.h / originalDimensions.w)));
                        }
                      }}
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] uppercase font-bold text-slate-400">Height (px)</label>
                    <input
                      type="number"
                      className="w-full glass-input text-xs"
                      value={resizeHeight}
                      onChange={(e) => {
                        const newH = Number(e.target.value);
                        setResizeHeight(newH);
                        if (maintainAspect && originalDimensions && originalDimensions.h > 0) {
                          setResizeWidth(Math.round(newH * (originalDimensions.w / originalDimensions.h)));
                        }
                      }}
                    />
                  </div>
                </div>
                <label className="flex items-center space-x-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={maintainAspect}
                    onChange={(e) => setMaintainAspect(e.target.checked)}
                    className="accent-indigo-500"
                  />
                  <span className="text-xs text-slate-500 dark:text-slate-400">Maintain Aspect Ratio</span>
                </label>
              </div>
            )}

            {mode === "metadata" && metadata && (
              <div className="glass-panel p-4 rounded-xl space-y-2.5 max-w-md">
                <h4 className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400">Image Details</h4>
                <div className="space-y-1.5">
                  {Object.entries(metadata).map(([key, val]) => (
                    <div key={key} className="flex justify-between text-xs">
                      <span className="text-slate-500">{key}:</span>
                      <span className="font-semibold text-slate-700 dark:text-slate-300">{val}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Execute Button (Not for metadata mode) */}
            {mode !== "metadata" && (
              <button
                onClick={processImage}
                disabled={processing}
                className="px-6 py-2.5 rounded-lg text-xs font-semibold bg-indigo-600 hover:bg-indigo-700 text-white disabled:opacity-50 transition-all flex items-center space-x-1.5 shadow-md"
              >
                <span>{processing ? "Processing Image..." : `Apply Image ${mode}`}</span>
              </button>
            )}
          </div>
        )}

        {/* Download Output */}
        {downloadUrl && (
          <div className="p-4 rounded-xl border border-emerald-500/20 bg-emerald-500/5 flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <div className="p-2 rounded bg-emerald-500/10 text-emerald-500">
                <ImageIcon className="w-5 h-5" />
              </div>
              <div>
                <span className="text-xs font-bold text-slate-800 dark:text-slate-200 block">Success! Image Ready</span>
                <span className="text-[10px] text-slate-400">Your processed image is ready for download.</span>
              </div>
            </div>
            <a
              href={downloadUrl}
              download={`processed_${Date.now()}.${mode === "convert" ? (targetFormat.split("/")[1] || "png") : (selectedFiles[0]?.type.split("/")[1] || "png")}`}
              className="px-4 py-2 rounded-lg text-xs font-semibold bg-emerald-500 hover:bg-emerald-600 text-white transition-all shadow-sm"
            >
              Download Image
            </a>
          </div>
        )}
      </div>
    </ToolLayout>
  );
}
