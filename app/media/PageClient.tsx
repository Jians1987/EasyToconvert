"use client";

import React, { useRef, useState } from "react";
import ToolLayout from "@/components/ToolLayout";
import Dropzone from "@/components/Dropzone";
import { useConversions } from "@/app/providers";
import { FFmpeg } from "@ffmpeg/ffmpeg";
import { fetchFile, toBlobURL } from "@ffmpeg/util";
import { Video, Music, Star, AlertTriangle, Download, Loader2, Cpu, Sparkles, Copy, Check } from "lucide-react";

type MediaMode = "compress" | "extract" | "audio-trim" | "transcribe";

// Single-threaded core — no SharedArrayBuffer, so no COOP/COEP headers required.
const CORE_BASE = "https://unpkg.com/@ffmpeg/core@0.12.6/dist/umd";

// Conservative client-side precheck; the server enforces the real limit.
const MAX_TRANSCRIBE_BYTES = 25 * 1024 * 1024;

export function MediaPageClient() {
  const [mode, setMode] = useState<MediaMode>("compress");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [targetBitrate, setTargetBitrate] = useState(128);
  const [audioFormat, setAudioFormat] = useState<"mp3" | "wav">("mp3");
  const [trimStart, setTrimStart] = useState(0);
  const [trimEnd, setTrimEnd] = useState(10);

  const [engineState, setEngineState] = useState<"idle" | "loading" | "ready" | "error">("idle");
  const [processing, setProcessing] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [outputUrl, setOutputUrl] = useState<string | null>(null);
  const [outputName, setOutputName] = useState("output");
  const [outputIsVideo, setOutputIsVideo] = useState(false);
  const [transcript, setTranscript] = useState<string | null>(null);
  const [transcriptCopied, setTranscriptCopied] = useState(false);

  React.useEffect(() => () => {
    if (outputUrl?.startsWith("blob:")) URL.revokeObjectURL(outputUrl);
  }, [outputUrl]);

  const ffmpegRef = useRef<FFmpeg | null>(null);
  const { addHistoryItem, favorites, toggleFavorite } = useConversions();

  const handleFilesSelected = (files: File[]) => {
    if (files.length > 0) {
      setSelectedFile(files[0]);
      setOutputUrl(null);
      setError(null);
    }
  };

  // Lazy-load the FFmpeg engine the first time it is needed.
  const ensureEngine = async (): Promise<FFmpeg> => {
    if (ffmpegRef.current) return ffmpegRef.current;
    setEngineState("loading");
    try {
      const ffmpeg = new FFmpeg();
      ffmpeg.on("progress", ({ progress: p }) => {
        setProgress(Math.min(100, Math.max(0, Math.round(p * 100))));
      });
      const [coreURL, wasmURL] = await Promise.all([
        toBlobURL(`${CORE_BASE}/ffmpeg-core.js`, "text/javascript"),
        toBlobURL(`${CORE_BASE}/ffmpeg-core.wasm`, "application/wasm"),
      ]);
      await ffmpeg.load({ coreURL, wasmURL });
      ffmpegRef.current = ffmpeg;
      setEngineState("ready");
      return ffmpeg;
    } catch (e: any) {
      setEngineState("error");
      throw new Error(
        `Failed to load FFmpeg engine from CDN. ${e?.message || "Check your internet connection and try again."}`
      );
    }
  };

  const getExt = (name: string) => name.split(".").pop()?.toLowerCase() || "bin";

  const runConversion = async () => {
    if (!selectedFile) return;
    setProcessing(true);
    setError(null);
    setOutputUrl(null);
    setProgress(0);

    try {
      const ffmpeg = await ensureEngine();
      const inputName = `input.${getExt(selectedFile.name)}`;
      await ffmpeg.writeFile(inputName, await fetchFile(selectedFile));

      let args: string[] = [];
      let outFile = "";
      let outMime = "";
      const baseName = selectedFile.name.replace(/\.[^.]+$/, "");

      if (mode === "compress") {
        outFile = `compressed.${audioFormat}`;
        outMime = audioFormat === "mp3" ? "audio/mpeg" : "audio/wav";
        args =
          audioFormat === "mp3"
            ? ["-i", inputName, "-vn", "-b:a", `${targetBitrate}k`, outFile]
            : ["-i", inputName, "-vn", outFile];
      } else if (mode === "extract") {
        outFile = "audio.mp3";
        outMime = "audio/mpeg";
        args = ["-i", inputName, "-vn", "-b:a", `${targetBitrate}k`, outFile];
      } else {
        // audio-trim
        if (trimEnd <= trimStart) {
          throw new Error("End time must be greater than start time.");
        }
        outFile = "trimmed.mp3";
        outMime = "audio/mpeg";
        args = ["-i", inputName, "-ss", `${trimStart}`, "-to", `${trimEnd}`, "-b:a", "192k", outFile];
      }

      await ffmpeg.exec(args);

      const data = (await ffmpeg.readFile(outFile)) as Uint8Array;
      if (!data || data.length === 0) {
        throw new Error("FFmpeg produced an empty file. The input may be unsupported or corrupted.");
      }
      const blob = new Blob([data.buffer as ArrayBuffer], { type: outMime });
      const url = URL.createObjectURL(blob);

      // Detect if output is a video file based on the output MIME type
      const isVideoResult = outMime.startsWith("video/");
      const finalName = `${baseName}_${mode}.${outFile.split(".").pop()}`;
      setOutputUrl(url);
      setOutputName(finalName);
      setOutputIsVideo(isVideoResult);

      addHistoryItem({
        fileName: finalName,
        fileSize: blob.size,
        toolType: `media-${mode}`,
        status: "success",
        downloadUrl: url,
      });

      // Best-effort cleanup of the virtual FS
      try {
        await ffmpeg.deleteFile(inputName);
        await ffmpeg.deleteFile(outFile);
      } catch {
        /* ignore */
      }
    } catch (e: any) {
      console.error("FFmpeg processing failed:", e);
      if (engineState !== "ready" && !ffmpegRef.current) setEngineState("error");
      setError(
        e?.message
          ? `Processing failed: ${e.message}`
          : "Processing failed. The FFmpeg engine loads from a CDN — check your connection and try again."
      );
    } finally {
      setProcessing(false);
    }
  };

  // Cloud AI (opt-in): transcribes via Groq Whisper. Unlike the FFmpeg modes
  // above, this sends the audio track to Groq's API.
  const runTranscription = async () => {
    if (!selectedFile) return;
    setProcessing(true);
    setError(null);
    setTranscript(null);
    setProgress(0);

    try {
      let audioBlob: Blob = selectedFile;
      let audioName = selectedFile.name;

      if (!selectedFile.type.startsWith("audio/")) {
        // Video input — extract just the audio track first so we upload a
        // small audio file instead of the full video.
        const ffmpeg = await ensureEngine();
        const inputName = `input.${getExt(selectedFile.name)}`;
        await ffmpeg.writeFile(inputName, await fetchFile(selectedFile));
        await ffmpeg.exec(["-i", inputName, "-vn", "-b:a", "128k", "extracted.mp3"]);
        const data = (await ffmpeg.readFile("extracted.mp3")) as Uint8Array;
        if (!data || data.length === 0) {
          throw new Error("Could not extract an audio track from this file.");
        }
        audioBlob = new Blob([data.buffer as ArrayBuffer], { type: "audio/mpeg" });
        audioName = "extracted.mp3";
        try {
          await ffmpeg.deleteFile(inputName);
          await ffmpeg.deleteFile("extracted.mp3");
        } catch {
          /* ignore */
        }
      }

      if (audioBlob.size > MAX_TRANSCRIBE_BYTES) {
        throw new Error(
          `Audio is too large to transcribe (${(audioBlob.size / (1024 * 1024)).toFixed(1)}MB). Limit is ${
            MAX_TRANSCRIBE_BYTES / (1024 * 1024)
          }MB.`
        );
      }

      setProgress(60);
      const form = new FormData();
      form.append("file", audioBlob, audioName);

      const res = await fetch("/api/ai/transcribe", { method: "POST", body: form });
      if (!res.ok) {
        let message = `Transcription failed (${res.status})`;
        try {
          const body = await res.json();
          if (body?.error) message = String(body.error);
        } catch {
          /* non-JSON error body */
        }
        if (res.status === 503) {
          message = `${message}. Set GROQ_API_KEY in .env.local and restart the dev server.`;
        }
        throw new Error(message);
      }

      const data = await res.json();
      const text = String(data.text || "").trim();
      setTranscript(text || "_No speech was detected in this audio._");
      setProgress(100);

      addHistoryItem({
        fileName: `${selectedFile.name.replace(/\.[^.]+$/, "")}_transcript.txt`,
        fileSize: text.length,
        toolType: "media-transcribe",
        status: "success",
      });
    } catch (e: any) {
      console.error("Transcription failed:", e);
      setError(e?.message || "Transcription failed.");
    } finally {
      setProcessing(false);
    }
  };

  const downloadTranscript = () => {
    if (!transcript || !selectedFile) return;
    const blob = new Blob([transcript], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${selectedFile.name.replace(/\.[^.]+$/, "")}_transcript.txt`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const copyTranscript = async () => {
    if (!transcript) return;
    await navigator.clipboard.writeText(transcript);
    setTranscriptCopied(true);
    setTimeout(() => setTranscriptCopied(false), 1500);
  };

  const isPinned = favorites.includes("media-tools");

  return (
    <ToolLayout
      title="Video & Audio Studio"
      description="Compress audio, extract MP3 from video, trim clips, and transcribe speech to text — FFmpeg tools run locally; transcription is Cloud AI (opt-in)."
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
              { id: "transcribe", label: "Transcribe" },
            ].map((t) => (
              <button
                key={t.id}
                onClick={() => {
                  setMode(t.id as MediaMode);
                  setOutputUrl(null);
                  setTranscript(null);
                  setError(null);
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

        {/* Engine status banner */}
        {mode === "transcribe" ? (
          <div className="p-3.5 rounded-xl border border-amber-500/30 bg-amber-50/50 dark:bg-amber-950/10 flex items-start space-x-2.5">
            <Sparkles className="w-4 h-4 text-amber-500 mt-0.5 flex-shrink-0" />
            <div className="text-xs text-amber-700 dark:text-amber-400">
              <span className="font-bold block">Cloud AI — Groq Whisper</span>
              <span>
                Video input is first trimmed to audio locally, then the audio track is sent to Groq's Whisper API for
                transcription. This is the only mode on this page that sends data off your device.
              </span>
            </div>
          </div>
        ) : (
          <div className="p-3.5 rounded-xl border border-indigo-500/20 bg-indigo-50/50 dark:bg-indigo-950/10 flex items-start space-x-2.5">
            <Cpu className="w-4 h-4 text-indigo-500 mt-0.5 flex-shrink-0" />
            <div className="text-xs text-indigo-700 dark:text-indigo-400">
              <span className="font-bold block">FFmpeg WebAssembly Engine</span>
              <span>
                {engineState === "ready"
                  ? "Engine ready. All processing happens locally in your browser — files never leave your device."
                  : engineState === "loading"
                  ? "Loading the FFmpeg engine (~25MB, first use only)…"
                  : engineState === "error"
                  ? "The engine failed to load. It is fetched from a CDN — check your connection and retry."
                  : "The engine (~25MB) loads from a CDN on first run, then processes everything locally."}
              </span>
            </div>
          </div>
        )}

        {/* Dropzone */}
        <Dropzone
          onFilesSelected={handleFilesSelected}
          accept={mode === "audio-trim" ? "audio/*" : "video/*,audio/*"}
          multiple={false}
          maxSizeMB={200}
          title={mode === "audio-trim" ? "Upload an audio file to trim" : mode === "transcribe" ? "Upload audio or video to transcribe" : "Upload media (MP4, MOV, MP3, WAV…)"}
        />

        {/* Configurations */}
        {selectedFile && (
          <div className="space-y-4 pt-2">
            {(mode === "compress" || mode === "extract") && (
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

                {mode === "compress" && (
                  <div className="space-y-3 p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-white/40 dark:bg-slate-900/30 flex flex-col justify-center">
                    <label className="text-[10px] uppercase font-bold text-slate-400">Export format</label>
                    <select
                      className="w-full glass-input text-xs mt-1"
                      value={audioFormat}
                      onChange={(e) => setAudioFormat(e.target.value as "mp3" | "wav")}
                    >
                      <option value="mp3">MP3 Audio (.mp3)</option>
                      <option value="wav">WAV Audio (.wav)</option>
                    </select>
                  </div>
                )}
              </div>
            )}

            {mode === "audio-trim" && (
              <div className="space-y-4 p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-white/40 dark:bg-slate-900/30 max-w-xl">
                <div className="flex items-center space-x-3 text-xs">
                  <Music className="w-4 h-4 text-indigo-400" />
                  <span className="font-mono text-slate-500 truncate max-w-xs">{selectedFile.name}</span>
                </div>
                <div className="grid grid-cols-2 gap-4 text-xs">
                  <div className="space-y-1">
                    <span>Start Trim (s)</span>
                    <input
                      type="number"
                      min="0"
                      className="w-full glass-input"
                      value={trimStart}
                      onChange={(e) => setTrimStart(Math.max(0, Number(e.target.value)))}
                    />
                  </div>
                  <div className="space-y-1">
                    <span>End Trim (s)</span>
                    <input
                      type="number"
                      min="0"
                      className="w-full glass-input"
                      value={trimEnd}
                      onChange={(e) => setTrimEnd(Math.max(0, Number(e.target.value)))}
                    />
                  </div>
                </div>
              </div>
            )}

            {/* Progress */}
            {processing && (
              <div className="space-y-1.5 max-w-xl">
                <div className="flex justify-between text-[10px] text-slate-400">
                  <span>{engineState === "loading" ? "Loading engine…" : "Processing…"}</span>
                  <span>{progress}%</span>
                </div>
                <div className="w-full bg-slate-200 dark:bg-slate-800 h-1.5 rounded-full overflow-hidden">
                  <div className="bg-indigo-500 h-full rounded-full transition-all" style={{ width: `${progress}%` }} />
                </div>
              </div>
            )}

            {/* Action Button */}
            <button
              onClick={mode === "transcribe" ? runTranscription : runConversion}
              disabled={processing}
              className={`px-6 py-2.5 rounded-lg text-xs font-semibold text-white disabled:opacity-50 transition-all flex items-center space-x-1.5 shadow-md ${
                mode === "transcribe" ? "bg-amber-500 hover:bg-amber-600" : "bg-indigo-600 hover:bg-indigo-700"
              }`}
            >
              {processing ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : mode === "transcribe" ? (
                <Sparkles className="w-3.5 h-3.5" />
              ) : (
                <Video className="w-3.5 h-3.5" />
              )}
              <span>
                {processing
                  ? mode === "transcribe"
                    ? "Transcribing…"
                    : engineState === "loading"
                    ? "Loading engine…"
                    : "Processing…"
                  : mode === "extract"
                  ? "Extract Audio"
                  : mode === "audio-trim"
                  ? "Trim Audio"
                  : mode === "transcribe"
                  ? "Transcribe Audio"
                  : "Compress Media"}
              </span>
            </button>
          </div>
        )}

        {/* Error */}
        {error && (
          <div className="p-3.5 rounded-xl border border-red-200 dark:border-red-900/50 bg-red-50 dark:bg-red-950/20 flex items-start space-x-2 text-xs text-red-600 dark:text-red-400">
            <AlertTriangle className="w-4 h-4 flex-shrink-0 mt-0.5" />
            <span>{error}</span>
          </div>
        )}

        {/* Output */}
        {outputUrl && (
          <div className="p-4 rounded-xl border border-emerald-500/20 bg-emerald-500/5 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-3">
                <div className="p-2 rounded bg-emerald-500/10 text-emerald-500">
                  <Music className="w-5 h-5" />
                </div>
                <div>
                  <span className="text-xs font-bold text-slate-800 dark:text-slate-200 block">Success! Media Ready</span>
                  <span className="text-[10px] text-slate-400 truncate max-w-xs block">{outputName}</span>
                </div>
              </div>
              <a
                href={outputUrl}
                download={outputName}
                className="px-4 py-2 rounded-lg text-xs font-semibold bg-emerald-500 hover:bg-emerald-600 text-white transition-all shadow-sm flex items-center space-x-1.5"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Download</span>
              </a>
            </div>
            {outputIsVideo ? (
              <video controls src={outputUrl} className="w-full max-w-md rounded-lg" />
            ) : (
              <audio controls src={outputUrl} className="w-full" />
            )}
          </div>
        )}

        {/* Transcript output */}
        {transcript && (
          <div className="p-4 rounded-xl border border-emerald-500/20 bg-emerald-500/5 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-3">
                <div className="p-2 rounded bg-emerald-500/10 text-emerald-500">
                  <Sparkles className="w-5 h-5" />
                </div>
                <div>
                  <span className="text-xs font-bold text-slate-800 dark:text-slate-200 block">Transcript Ready</span>
                  <span className="text-[10px] text-slate-400 truncate max-w-xs block">Groq Whisper Large v3 Turbo</span>
                </div>
              </div>
              <div className="flex items-center space-x-2">
                <button
                  onClick={copyTranscript}
                  className="px-3 py-2 rounded-lg text-xs font-semibold border border-slate-200 dark:border-slate-800 hover:bg-slate-100 dark:hover:bg-slate-800 transition-all flex items-center space-x-1.5"
                >
                  {transcriptCopied ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />}
                  <span>{transcriptCopied ? "Copied" : "Copy"}</span>
                </button>
                <button
                  onClick={downloadTranscript}
                  className="px-4 py-2 rounded-lg text-xs font-semibold bg-emerald-500 hover:bg-emerald-600 text-white transition-all shadow-sm flex items-center space-x-1.5"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>Download .txt</span>
                </button>
              </div>
            </div>
            <div className="p-3.5 rounded-lg bg-white/60 dark:bg-slate-900/40 border border-slate-200 dark:border-slate-800 text-xs leading-relaxed text-slate-700 dark:text-slate-300 whitespace-pre-wrap max-h-96 overflow-y-auto">
              {transcript}
            </div>
          </div>
        )}
      </div>
    </ToolLayout>
  );
}
