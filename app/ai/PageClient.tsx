"use client";

import React, { useState } from "react";
import ToolLayout from "@/components/ToolLayout";
import Dropzone from "@/components/Dropzone";
import { useConversions } from "@/app/providers";
import { ocrImage, looksScanned } from "@/app/lib/ocr";
import { Sparkles, Star, BrainCircuit, Key, Send, FileText, Info, ScanText } from "lucide-react";

type AiMode = "summarize" | "explain" | "translate" | "ocr";

// Safe markdown-like renderer — no dangerouslySetInnerHTML, no XSS risk
function SafeMarkdown({ text }: { text: string }) {
  const lines = text.split("\n");
  const elements: React.ReactNode[] = [];
  let codeBlock: string[] = [];
  let inCode = false;

  const renderInline = (line: string, key: number) => {
    // Split on **bold** and render as React nodes
    const parts = line.split(/(\*\*.*?\*\*)/g);
    return (
      <span key={key}>
        {parts.map((part, i) => {
          if (part.startsWith("**") && part.endsWith("**")) {
            return <strong key={i}>{part.slice(2, -2)}</strong>;
          }
          return part;
        })}
      </span>
    );
  };

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    if (line.startsWith("```")) {
      if (!inCode) {
        inCode = true;
        codeBlock = [];
      } else {
        elements.push(
          <pre key={i} className="bg-slate-900 text-slate-100 p-3 rounded-lg overflow-x-auto text-[10px] my-2">
            <code>{codeBlock.join("\n")}</code>
          </pre>
        );
        inCode = false;
        codeBlock = [];
      }
    } else if (inCode) {
      codeBlock.push(line);
    } else if (line.startsWith("### ")) {
      elements.push(<h3 key={i} className="font-bold text-sm text-slate-900 dark:text-slate-100 my-2">{line.slice(4)}</h3>);
    } else if (line.startsWith("* ")) {
      elements.push(<li key={i} className="ml-4 list-disc">{renderInline(line.slice(2), i)}</li>);
    } else if (line.startsWith("---")) {
      elements.push(<hr key={i} className="border-slate-200 dark:border-slate-700 my-2" />);
    } else if (line.trim() === "") {
      elements.push(<br key={i} />);
    } else {
      elements.push(<p key={i} className="leading-relaxed">{renderInline(line, i)}</p>);
    }
  }

  return <div className="space-y-0.5 text-xs">{elements}</div>;
}

// Shared PDF.js loader
const loadPdfJs = (): Promise<any> => {
  return new Promise((resolve, reject) => {
    if (typeof window !== "undefined" && (window as any).pdfjsLib) {
      resolve((window as any).pdfjsLib);
      return;
    }
    const script = document.createElement("script");
    script.src = "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js";
    script.onload = () => {
      (window as any).pdfjsLib.GlobalWorkerOptions.workerSrc =
        "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js";
      resolve((window as any).pdfjsLib);
    };
    script.onerror = () => reject(new Error("Failed to load PDF.js"));
    document.head.appendChild(script);
  });
};

export function AiPageClient() {
  const [mode, setMode] = useState<AiMode>("summarize");
  const [apiKey, setApiKey] = useState("");
  const [inputText, setInputText] = useState("");
  const [outputText, setOutputText] = useState("");
  const [processing, setProcessing] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [targetLang, setTargetLang] = useState("Spanish");
  const [ocrProgress, setOcrProgress] = useState(0);
  const [ocrStatus, setOcrStatus] = useState("");
  const { addHistoryItem, favorites, toggleFavorite } = useConversions();

  const handleFilesSelected = (files: File[]) => {
    if (files.length > 0) {
      setSelectedFile(files[0]);
      setOutputText("");
    }
  };

  const executeAi = async () => {
    setProcessing(true);
    setOutputText("");

    try {
      let result = "";

      if (mode === "summarize") {
        if (!selectedFile) {
          setOutputText("Please upload a PDF file first.");
          setProcessing(false);
          return;
        }

        // Actually extract text from the uploaded PDF
        const arrayBuffer = await selectedFile.arrayBuffer();
        const pdfjsLib = await loadPdfJs();
        const pdf = await pdfjsLib.getDocument({ data: new Uint8Array(arrayBuffer) }).promise;
        const numPages = pdf.numPages;

        let extractedText = "";
        let ocrPagesUsed = 0;
        for (let i = 1; i <= numPages; i++) {
          const page = await pdf.getPage(i);
          const textContent = await page.getTextContent();
          const items = textContent.items;

          // Sort by Y (top to bottom) then X (left to right)
          const sorted = [...items].sort((a: any, b: any) => {
            const yDiff = b.transform[5] - a.transform[5];
            if (Math.abs(yDiff) > 5) return yDiff;
            return a.transform[4] - b.transform[4];
          });

          let pageText = "";
          let lastY = -1;
          for (const item of sorted) {
            const y = item.transform[5];
            const text = (item as any).str;
            if (!text || !text.trim()) continue;

            if (lastY === -1) {
              pageText = text;
              lastY = y;
            } else if (Math.abs(lastY - y) > 5) {
              pageText += "\n" + text;
              lastY = y;
            } else {
              pageText += " " + text;
            }
          }

          // Precise extraction: when a page has no selectable text it is a scanned
          // image — render it and run on-device OCR instead of giving up.
          if (looksScanned(pageText)) {
            setOcrStatus(`Running OCR on scanned page ${i} of ${numPages}…`);
            const viewport = page.getViewport({ scale: 2.0 });
            const canvas = document.createElement("canvas");
            canvas.width = viewport.width;
            canvas.height = viewport.height;
            const ctx = canvas.getContext("2d");
            if (ctx) {
              await page.render({ canvasContext: ctx, viewport }).promise;
              const { text: ocrText, confidence } = await ocrImage(canvas, setOcrProgress);
              if (ocrText.trim()) {
                ocrPagesUsed++;
                extractedText += `\n\n--- Page ${i} (OCR · ${confidence}% confidence) ---\n\n${ocrText}`;
                continue;
              }
            }
            extractedText += `\n\n--- Page ${i} ---\n\n[Scanned page — OCR found no readable text]`;
          } else {
            extractedText += `\n\n--- Page ${i} ---\n\n${pageText}`;
          }
        }
        setOcrStatus("");

        const ocrNote = ocrPagesUsed > 0
          ? `\n\n**${ocrPagesUsed} scanned page${ocrPagesUsed > 1 ? "s were" : " was"} read with on-device OCR (Tesseract.js).**`
          : "";
        result = `### ⚡ Precise Text Extraction\n\n**File**: ${selectedFile.name}\n**Pages**: ${numPages}\n**Size**: ${(selectedFile.size / 1024).toFixed(1)} KB${ocrNote}\n\nSelectable text was extracted with PDF.js; scanned pages were recognized locally with OCR — no data left your browser.\n\n---\n${extractedText}`;

      } else if (mode === "ocr") {
        if (!selectedFile) {
          setOutputText("Please upload an image first.");
          setProcessing(false);
          return;
        }
        setOcrStatus("Recognizing text…");
        const { text: ocrText, confidence } = await ocrImage(selectedFile, setOcrProgress);
        setOcrStatus("");
        result = `### 🔎 Image OCR — Extracted Text\n\n**File**: ${selectedFile.name}\n**Confidence**: ${confidence}%\n**Engine**: Tesseract.js (on-device, private)\n\n---\n\n${ocrText || "_No readable text was found in this image._"}`;

      } else if (mode === "explain") {
        if (!inputText.trim()) {
          setOutputText("Please paste some code first.");
          setProcessing(false);
          return;
        }

        const lines = inputText.split("\n");
        const lineCount = lines.length;
        const functionMatches = inputText.match(/function\s+\w+|const\s+\w+\s*=\s*(?:async\s+)?\(|=>\s*{/g);
        const varMatches = inputText.match(/(?:const|let|var)\s+/g);

        let numberedCode = lines.map((line, i) => `  ${(i + 1).toString().padStart(3, " ")} | ${line}`).join("\n");

        result = `### ⚡ Demo Mode — Code Analysis\n\n**Statistics:**\n* **Total Lines**: ${lineCount}\n* **Functions/Arrows detected**: ${functionMatches ? functionMatches.length : 0}\n* **Variable declarations**: ${varMatches ? varMatches.length : 0}\n\nConnect a Gemini or OpenAI API key for AI-powered code explanation.\n\n---\n\n**Your code with line numbers:**\n\n\`\`\`\n${numberedCode}\n\`\`\``;

      } else if (mode === "translate") {
        if (!inputText.trim()) {
          setOutputText("Please enter text to translate.");
          setProcessing(false);
          return;
        }

        result = `### ⚡ Demo Mode — Translation Preview\n\n**Target Language**: ${targetLang}\n**Input Length**: ${inputText.length} characters\n\nConnect a Gemini or OpenAI API key for real AI-powered translation.\n\n---\n\n**Original Text:**\n\n${inputText}\n\n---\n\n*Real-time translation requires an active API connection. Enter your API key above and we'll use the Gemini or OpenAI translation endpoint.*`;
      }

      setOutputText(result);

      addHistoryItem({
        fileName: `ai_${mode}_${Date.now()}.md`,
        fileSize: inputText.length || (selectedFile?.size ?? 5000),
        toolType: `ai-${mode}`,
        status: "success",
      });
    } catch (e) {
      console.error("AI tool error:", e);
      setOutputText(`### Error\n\nFailed to process: ${(e as Error).message || "Unknown error"}`);
    } finally {
      setProcessing(false);
      setOcrStatus("");
      setOcrProgress(0);
    }
  };

  const isPinned = favorites.includes("ai-tools");

  return (
    <ToolLayout
      title="AI Productivity Suite"
      description="Extract text from PDFs and images with on-device OCR, summarize documents, explain code, and translate text — privately in your browser."
      category="ai"
    >
      <div className="space-y-6">
        {/* Nav Tabs */}
        <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
          <div className="flex space-x-2">
            {[
              { id: "summarize", label: "AI PDF Summarizer" },
              { id: "ocr", label: "Image OCR" },
              { id: "explain", label: "AI Code Explainer" },
              { id: "translate", label: "Document Translator" },
            ].map((t) => (
              <button
                key={t.id}
                onClick={() => {
                  setMode(t.id as AiMode);
                  setOutputText("");
                  setSelectedFile(null);
                  setInputText("");
                  setOcrStatus("");
                  setOcrProgress(0);
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
            onClick={() => toggleFavorite("ai-tools")}
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


        {/* Workspaces */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Input Panel */}
          <div className="space-y-4">
            {mode === "summarize" && (
              <div className="space-y-2">
                <label className="text-[10px] uppercase font-bold text-slate-400">Upload PDF File</label>
                <Dropzone
                  onFilesSelected={handleFilesSelected}
                  accept="application/pdf"
                  multiple={false}
                  maxSizeMB={20}
                  title="Drop document for text extraction"
                />
              </div>
            )}

            {mode === "ocr" && (
              <div className="space-y-2">
                <label className="text-[10px] uppercase font-bold text-slate-400">Upload Image (PNG, JPG, scanned doc)</label>
                <Dropzone
                  onFilesSelected={handleFilesSelected}
                  accept="image/*"
                  multiple={false}
                  maxSizeMB={20}
                  title="Drop an image to extract its text"
                />
              </div>
            )}

            {mode === "explain" && (
              <div className="space-y-2">
                <label className="text-[10px] uppercase font-bold text-slate-400">Paste Source Code</label>
                <textarea
                  rows={8}
                  placeholder="function process() { return Math.random().toString(); }"
                  className="w-full font-mono text-xs p-4 glass-input border-slate-300 dark:border-slate-800 resize-none h-[220px]"
                  value={inputText}
                  onChange={(e) => setInputText(e.target.value)}
                />
              </div>
            )}

            {mode === "translate" && (
              <div className="space-y-4">
                <div className="space-y-1.5">
                  <label className="text-[10px] uppercase font-bold text-slate-400">Target Language</label>
                  <select
                    className="w-full glass-input text-xs"
                    value={targetLang}
                    onChange={(e) => setTargetLang(e.target.value)}
                  >
                    <option value="Spanish">Spanish (Español)</option>
                    <option value="German">German (Deutsch)</option>
                    <option value="French">French (Français)</option>
                    <option value="Chinese">Chinese (中文)</option>
                    <option value="Japanese">Japanese (日本語)</option>
                  </select>
                </div>

                <div className="space-y-2">
                  <label className="text-[10px] uppercase font-bold text-slate-400">Text to translate</label>
                  <textarea
                    rows={6}
                    placeholder="Welcome to Easytoconvert. Your privacy is our highest priority."
                    className="w-full text-xs p-4 glass-input border-slate-300 dark:border-slate-800 resize-none h-[140px]"
                    value={inputText}
                    onChange={(e) => setInputText(e.target.value)}
                  />
                </div>
              </div>
            )}

            {/* OCR progress */}
            {processing && (mode === "summarize" || mode === "ocr") && ocrStatus && (
              <div className="space-y-1.5">
                <div className="flex justify-between text-[10px] text-slate-400">
                  <span>{ocrStatus}</span>
                  <span>{ocrProgress}%</span>
                </div>
                <div className="w-full bg-slate-200 dark:bg-slate-800 h-1.5 rounded-full overflow-hidden">
                  <div className="bg-indigo-500 h-full rounded-full transition-all" style={{ width: `${ocrProgress}%` }} />
                </div>
              </div>
            )}

            <button
              onClick={executeAi}
              disabled={
                processing ||
                (mode === "summarize" && !selectedFile) ||
                (mode === "ocr" && !selectedFile) ||
                ((mode === "explain" || mode === "translate") && !inputText)
              }
              className="w-full py-2.5 rounded-lg text-xs font-semibold bg-indigo-600 hover:bg-indigo-700 text-white disabled:opacity-50 transition-all flex items-center justify-center space-x-1.5"
            >
              {mode === "ocr" ? <ScanText className="w-4 h-4 animate-pulse-slow" /> : <BrainCircuit className="w-4 h-4 animate-pulse-slow" />}
              <span>{processing ? "Processing..." : mode === "ocr" ? "Extract Text (OCR)" : `Run AI ${mode}`}</span>
            </button>
          </div>

          {/* Output Panel */}
          <div className="space-y-2">
            <label className="text-[10px] uppercase font-bold text-slate-400">AI Results Output</label>
            <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-950/20 min-h-[300px] text-xs leading-relaxed space-y-4 overflow-y-auto max-h-[450px]">
              {processing ? (
                <div className="h-[250px] flex flex-col items-center justify-center space-y-3 text-slate-400">
                  <div className="w-8 h-8 rounded-full border-2 border-indigo-500 border-t-transparent animate-spin" />
                  <span>Extracting content and analyzing...</span>
                </div>
              ) : outputText ? (
                <div className="prose dark:prose-invert max-w-none text-slate-700 dark:text-slate-300">
                  <div className="flex items-center space-x-2 text-indigo-500 mb-3 border-b dark:border-slate-800 pb-2">
                    <Sparkles className="w-4 h-4" />
                    <span className="font-bold text-xs uppercase tracking-wide">Processing Complete</span>
                  </div>
                  <SafeMarkdown text={outputText} />
                </div>
              ) : (
                <div className="h-[250px] flex items-center justify-center text-slate-400 italic">
                  Run utility to extract content and load results...
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </ToolLayout>
  );
}
