"use client";

import React, { useState, useRef } from "react";
import { UploadCloud, File, X, AlertCircle } from "lucide-react";

interface DropzoneProps {
  onFilesSelected: (files: File[]) => void;
  accept?: string;
  maxSizeMB?: number;
  multiple?: boolean;
  title?: string;
  description?: string;
}

export default function Dropzone({
  onFilesSelected,
  accept = "*",
  maxSizeMB = 50,
  multiple = true,
  title = "Drag & Drop files here",
  description = "or click to browse your files",
}: DropzoneProps) {
  const [isDragActive, setIsDragActive] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [queuedFiles, setQueuedFiles] = useState<File[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const processFiles = (files: FileList) => {
    setError(null);
    const validFiles: File[] = [];
    const maxSizeBytes = maxSizeMB * 1024 * 1024;

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      if (file.size > maxSizeBytes) {
        setError(`File ${file.name} exceeds the maximum size limit of ${maxSizeMB}MB.`);
        continue;
      }
      validFiles.push(file);
    }

    if (validFiles.length > 0) {
      const newQueue = multiple ? [...queuedFiles, ...validFiles] : [validFiles[0]];
      setQueuedFiles(newQueue);
      onFilesSelected(newQueue);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragActive(true);
  };

  const handleDragLeave = () => {
    setIsDragActive(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragActive(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      processFiles(e.dataTransfer.files);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      processFiles(e.target.files);
    }
  };

  const removeFile = (index: number) => {
    const updated = queuedFiles.filter((_, i) => i !== index);
    setQueuedFiles(updated);
    onFilesSelected(updated);
  };

  const triggerFileInput = () => {
    fileInputRef.current?.click();
  };

  const formatBytes = (bytes: number) => {
    if (bytes === 0) return "0 Bytes";
    const k = 1024;
    const sizes = ["Bytes", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
  };

  return (
    <div className="w-full space-y-4">
      {/* Drop Zone Area */}
      <div
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        onClick={triggerFileInput}
        className={`w-full py-10 px-6 border-2 border-dashed rounded-xl cursor-pointer transition-all flex flex-col items-center justify-center text-center backdrop-blur-sm ${
          isDragActive
            ? "border-indigo-500 bg-indigo-50/10 dark:bg-indigo-950/10 scale-[1.01]"
            : "border-slate-300 dark:border-slate-800 hover:border-slate-400 dark:hover:border-slate-700 bg-white/40 dark:bg-slate-900/30"
        }`}
      >
        <input
          type="file"
          ref={fileInputRef}
          onChange={handleFileChange}
          accept={accept}
          multiple={multiple}
          className="hidden"
        />

        <div className="p-4 rounded-full bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-indigo-500 mb-4 animate-pulse-slow">
          <UploadCloud className="w-8 h-8" />
        </div>

        <h3 className="font-semibold text-slate-800 dark:text-slate-200 text-sm md:text-base">
          {title}
        </h3>
        <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
          {description}
        </p>
        <span className="text-[10px] text-slate-400 dark:text-slate-500 mt-3 border border-slate-200 dark:border-slate-800 rounded px-1.5 py-0.5">
          Max File Size: {maxSizeMB}MB
        </span>
      </div>

      {/* Error Alert */}
      {error && (
        <div className="p-3 bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-900/50 rounded-lg flex items-center space-x-2 text-xs text-red-600 dark:text-red-400">
          <AlertCircle className="w-4 h-4 flex-shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* File Queue List */}
      {queuedFiles.length > 0 && (
        <div className="space-y-2">
          <h4 className="text-xs font-semibold uppercase tracking-wider text-slate-400">
            Selected Files ({queuedFiles.length})
          </h4>
          <div className="space-y-1.5 max-h-48 overflow-y-auto pr-1">
            {queuedFiles.map((file, idx) => (
              <div
                key={idx}
                className="flex items-center justify-between p-2 rounded-lg bg-white/60 dark:bg-slate-900/50 border border-slate-200/50 dark:border-slate-800/50 text-xs"
              >
                <div className="flex items-center space-x-2.5 min-w-0">
                  <File className="w-4 h-4 text-indigo-400 flex-shrink-0" />
                  <span className="truncate font-medium text-slate-700 dark:text-slate-300">
                    {file.name}
                  </span>
                  <span className="text-[10px] text-slate-400 flex-shrink-0">
                    ({formatBytes(file.size)})
                  </span>
                </div>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    removeFile(idx);
                  }}
                  className="p-1 rounded text-slate-400 hover:text-red-500 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
