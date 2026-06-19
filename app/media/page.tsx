"use client";

import React, { useState, useRef } from "react";
import ToolLayout from "@/components/ToolLayout";
import Dropzone from "@/components/Dropzone";
import { useConversions } from "@/app/providers";
import { Video, Music, Star, Sliders, Play, Pause, Scissors, Download, RefreshCw } from "lucide-react";

type MediaMode = "compress" | "extract" | "audio-trim";

export default function MediaTools() {
  const [mode, setMode] = useState<MediaMode>("compress");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [processing, setProcessing] = useState(false);
  const [targetBitrate, setTargetBitrate] = useState(128); // kbps
  const [audioFormat, setAudioFormat] = useState("audio/mp3");
  const [trimStart, setTrimStart] = useState(0);
  const [trimEnd, setTrimEnd] = useState(10);
  const [playing, setPlaying] = useState(false);
  const [downloadUrl, setDownloadUrl] = useState<string | null>(null);
  
  const audioContextRef = useRef<AudioContext | null>(null);
  const audioBufferRef = useRef<AudioBuffer | null>(null);
  const { addHistoryItem, favorites, toggleFavorite } = useConversions();

  const handleFilesSelected = (files: File[]) => {
    if (files.length > 0) {
      setSelectedFile(files[0]);
      setDownloadUrl(null);
      setPlaying(false);
    }
  };

  const processMedia = async () => {
    if (!selectedFile) return;
    setProcessing(true);
    setDownloadUrl(null);

    // Simulate conversion latency
    setTimeout(() => {
      // Create mockup download link
      const blob = new Blob([new Uint8Array(1000)], { type: mode === "extract" ? "audio/mp3" : selectedFile.type });
      const url = URL.createObjectURL(blob);
      setDownloadUrl(url);
      setProcessing(false);

      addHistoryItem({
        fileName: mode === "extract" ? `extracted_${selectedFile.name.split(".")[0]}.mp3` : `optimized_${selectedFile.name}`,
        fileSize: blob.size,
        toolType: `media-${mode}`,
        status: "success",
        downloadUrl: url,
      });
    }, 2500);
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
                  setDownloadUrl(null);
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

        {/* Dropzone */}
        <Dropzone
          onFilesSelected={handleFilesSelected}
          accept={mode === "audio-trim" ? "audio/*" : "video/*,audio/*"}
          multiple={false}
          maxSizeMB={100}
          title={
            mode === "audio-trim" ? "Upload an audio file to trim" : "Upload media (MP4, AVI, MP3, WAV)"
          }
        />

        {/* Media configurations */}
        {selectedFile && (
          <div className="space-y-4 pt-2">
            {mode === "compress" && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 max-w-xl">
                {/* Sliders */}
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

                {/* Target Format */}
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
                  <button
                    onClick={() => setPlaying(!playing)}
                    className="p-2 rounded-full bg-indigo-500 text-white hover:bg-indigo-650"
                  >
                    {playing ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
                  </button>
                  <span className="font-mono text-slate-500 truncate max-w-xs">{selectedFile.name}</span>
                </div>

                {/* Timeline Sliders */}
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

            {/* Action button */}
            <button
              onClick={processMedia}
              disabled={processing}
              className="px-6 py-2.5 rounded-lg text-xs font-semibold bg-indigo-600 hover:bg-indigo-755 text-white disabled:opacity-50 transition-all flex items-center space-x-1.5 shadow-md"
            >
              <span>{processing ? "Compressing / Extracting..." : `Apply Media ${mode}`}</span>
            </button>
          </div>
        )}

        {/* Download Output */}
        {downloadUrl && (
          <div className="p-4 rounded-xl border border-emerald-500/20 bg-emerald-500/5 flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <div className="p-2 rounded bg-emerald-500/10 text-emerald-500">
                <Music className="w-5 h-5" />
              </div>
              <div>
                <span className="text-xs font-bold text-slate-850 dark:text-slate-250 block">Success! File Ready</span>
                <span className="text-[10px] text-slate-450 text-slate-400">Your processed media file is ready for download.</span>
              </div>
            </div>
            <a
              href={downloadUrl}
              download={
                mode === "extract"
                  ? `extracted_${selectedFile ? selectedFile.name.split(".")[0] : "audio"}.mp3`
                  : `optimized_${selectedFile ? selectedFile.name : "media"}`
              }
              className="px-4 py-2 rounded-lg text-xs font-semibold bg-emerald-500 hover:bg-emerald-600 text-white transition-all shadow-sm"
            >
              Download File
            </a>
          </div>
        )}
      </div>
    </ToolLayout>
  );
}
