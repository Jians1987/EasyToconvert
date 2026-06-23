"use client";

import React, { useState } from "react";
import ToolLayout from "@/components/ToolLayout";
import Dropzone from "@/components/Dropzone";
import { useConversions } from "@/app/providers";
import { Video, Music, Star, AlertTriangle } from "lucide-react";

type MediaMode = "compress" | "extract" | "audio-trim";

export default function MediaTools() {
  const [mode, setMode] = useState<MediaMode>("compress");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [targetBitrate, setTargetBitrate] = useState(128);
  const [audioFormat, setAudioFormat] = useState("audio/mp3");
  const [trimStart, setTrimStart] = useState(0);
  const [trimEnd, setTrimEnd] = useState(10);
  const { favorites, toggleFavorite } = useConversions();

  const handleFilesSelected = (files: File[]) => {
    if (files.length > 0) {
      setSelectedFile(files[0]);
    }
  };

  const isPinned = favorites.includes("media-tools");

  return (
    <ToolLayout
      title="Video & Audio Studio"
      description="Compress video files, extract MP3 audio, trim segments, and convert formats locally using custom bitrates."
      category="media"
    >
      <div className="space-y-6">
        {/* Nav Tabs */}
        <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
          <div className="flex space-x-2">
            {[
              { id: "compress", label: "Media Compressor" },
              { id: "extract", label: "Extract Audio" },
              { id: "audio-trim", label: "Audio Cutter" },
            ].map((t) => (
              <button
                key={t.id}
                onClick={() => {
                  setMode(t.id as MediaMode);
                  setSelectedFile(null);
                }}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-all ${
                  mode === t.id
                    ? "bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900"
                    : "text-slate-500 hover:text-slate-800 dark:hover:text-slate-200"
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>

          <button
            onClick={() => toggleFavorite("media-tools")}
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

        {/* Coming Soon Banner */}
        <div className="p-5 rounded-xl border border-amber-500/30 bg-amber-50/50 dark:bg-amber-950/10 space-y-3">
          <div className="flex items-start space-x-3">
            <AlertTriangle className="w-5 h-5 text-amber-500 mt-0.5 flex-shrink-0" />
            <div className="space-y-2">
              <h4 className="text-sm font-bold text-amber-700 dark:text-amber-400">
                Coming Soon — FFmpeg WebAssembly Integration
              </h4>
              <p className="text-xs text-amber-600 dark:text-amber-400/80 leading-relaxed">
                Browser-based video and audio processing requires FFmpeg compiled to WebAssembly, which is currently being integrated.
                In the meantime, explore our fully working <a href="/pdf" className="underline font-semibold">PDF tools</a>, <a href="/image" className="underline font-semibold">Image tools</a>, <a href="/data" className="underline font-semibold">Data converters</a>, and <a href="/developer" className="underline font-semibold">Developer utilities</a>.
              </p>
            </div>
          </div>
        </div>

        {/* Media configurations (shown but disabled — FFmpeg not yet available) */}
        {selectedFile && (
          <div className="space-y-4 pt-2 opacity-60 pointer-events-none">
            {mode === "compress" && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 max-w-xl">
                <div className="space-y-3.5 p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-white/40 dark:bg-slate-900/30">
                  <div className="flex justify-between items-center text-xs">
                    <span>Target Audio Bitrate</span>
                    <span className="font-bold text-indigo-500">{targetBitrate} kbps</span>
                  </div>
                  <input
                    type="range"
                    min="64"
                    max="320"
                    step="32"
                    className="w-full accent-indigo-500"
                    value={targetBitrate}
                    onChange={(e) => setTargetBitrate(Number(e.target.value))}
                  />
                  <div className="flex justify-between text-[10px] text-slate-400">
                    <span>Low (64k)</span>
                    <span>High (320k)</span>
                  </div>
                </div>

                <div className="space-y-3 p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-white/40 dark:bg-slate-900/30 flex flex-col justify-center">
                  <label className="text-[10px] uppercase font-bold text-slate-400">Export format</label>
                  <select
                    className="w-full glass-input text-xs mt-1"
                    value={audioFormat}
                    onChange={(e) => setAudioFormat(e.target.value)}
                  >
                    <option value="audio/mp3">MP3 Audio (.mp3)</option>
                    <option value="audio/wav">WAV Audio (.wav)</option>
                  </select>
                </div>
              </div>
            )}

            {mode === "audio-trim" && (
              <div className="space-y-4 p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-white/40 dark:bg-slate-900/30 max-w-xl">
                <div className="flex items-center space-x-3 text-xs">
                  <span className="font-mono text-slate-500 truncate max-w-xs">{selectedFile.name}</span>
                </div>
                <div className="grid grid-cols-2 gap-4 text-xs">
                  <div className="space-y-1">
                    <span>Start Trim (s)</span>
                    <input
                      type="number"
                      className="w-full glass-input"
                      value={trimStart}
                      onChange={(e) => setTrimStart(Number(e.target.value))}
                    />
                  </div>
                  <div className="space-y-1">
                    <span>End Trim (s)</span>
                    <input
                      type="number"
                      className="w-full glass-input"
                      value={trimEnd}
                      onChange={(e) => setTrimEnd(Number(e.target.value))}
                    />
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Disabled Action Button */}
        {selectedFile && (
          <button
            disabled
            className="px-6 py-2.5 rounded-lg text-xs font-semibold bg-slate-400 text-white cursor-not-allowed transition-all flex items-center space-x-1.5 shadow-md"
          >
            <AlertTriangle className="w-3.5 h-3.5" />
            <span>Coming Soon — Requires FFmpeg WASM</span>
          </button>
        )}
      </div>
    </ToolLayout>
  );
}
