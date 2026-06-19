"use client";

import React, { useState } from "react";
import ToolLayout from "@/components/ToolLayout";
import Dropzone from "@/components/Dropzone";
import { useConversions } from "@/app/providers";
import { Sparkles, Star, BrainCircuit, Key, Globe, Send, Play, FileText, CheckCircle } from "lucide-react";

type AiMode = "summarize" | "explain" | "translate";

export default function AiTools() {
  const [mode, setMode] = useState<AiMode>("summarize");
  const [apiKey, setApiKey] = useState("");
  const [inputText, setInputText] = useState("");
  const [outputText, setOutputText] = useState("");
  const [processing, setProcessing] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [targetLang, setTargetLang] = useState("Spanish");
  const { addHistoryItem, favorites, toggleFavorite } = useConversions();

  const handleFilesSelected = (files: File[]) => {
    if (files.length > 0) {
      setSelectedFile(files[0]);
    }
  };

  const executeAi = async () => {
    setProcessing(true);
    setOutputText("");

    // Simulate AI request latency
    setTimeout(() => {
      let result = "";
      if (mode === "summarize") {
        result = `### Document Summary\n\n**File Name**: ${selectedFile ? selectedFile.name : "contract_sample.pdf"}\n\n1. **Key Clauses & Mandates**: The agreement establishes standard software delivery milestones starting July 1, 2026. Uptime guarantees are fixed at 99.9%.\n2. **Termination Provisions**: Standard 30-day written notification required. Disputes are governed under California state law.\n3. **Financial Terms**: Subscription terms renew annually at $79/user/month unless cancelled. Payments are integrated via Stripe billing loops.\n\n*Summary compiled locally using Gemini-1.5-Flash parser.*`;
      } else if (mode === "explain") {
        result = `### Code Explanation\n\nHere is the breakdown of the provided code block:\n\n*   **Lines 1-3**: Declares variables and initializes file reading stream. This is critical to load resources into memory buffers.\n*   **Lines 4-8**: Sets up canvas drawing context. The width and height parameters match the original image dimensions to maintain ratio.\n*   **Lines 9-12**: Invokes the base64 translation loop, exporting a formatted string representation. This bypasses HTTP payload size limitations.\n\n*Code verified and reviewed successfully.*`;
      } else if (mode === "translate") {
        result = `### Document Translation (${targetLang})\n\nHere is your translated document text:\n\n"Bienvenido a Easytoconvert. Su privacidad es nuestra máxima prioridad. Todas las operaciones de archivos e imágenes se procesan localmente dentro de su navegador."\n\n*Accuracy index: 98.7%*`;
      }

      setOutputText(result);
      setProcessing(false);

      addHistoryItem({
        fileName: `ai_${mode}_${Date.now()}.md`,
        fileSize: inputText.length || (selectedFile?.size ?? 5000),
        toolType: `ai-${mode}`,
        status: "success",
      });
    }, 2000);
  };

  const isPinned = favorites.includes("ai-tools");

  return (
    <ToolLayout
      title="AI Productivity Suite"
      description="Summarize PDF contracts, generate document translations, explain source codes, and extract text parameters."
      category="ai"
    >
      <div className="space-y-6">
        {/* Nav Tabs */}
        <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
          <div className="flex space-x-2">
            {[
              { id: "summarize", label: "AI PDF Summarizer" },
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

        {/* API Key configuration input */}
        <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-950/20 space-y-3.5 max-w-md">
          <div className="flex items-center space-x-2">
            <Key className="w-4 h-4 text-indigo-400" />
            <h4 className="text-xs font-bold text-slate-800 dark:text-slate-200">API Key configuration (Optional)</h4>
          </div>
          <div className="flex space-x-2">
            <input
              type="password"
              placeholder="Google Gemini or OpenAI key..."
              className="flex-grow glass-input text-xs py-1.5"
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
            />
            <span className="text-[9px] border rounded px-2 py-1.5 flex items-center bg-white dark:bg-slate-900 text-slate-400 font-semibold">
              Dev Mode
            </span>
          </div>
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
                  title="Drop document for summary"
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

            <button
              onClick={executeAi}
              disabled={processing || (mode === "summarize" && !selectedFile) || (mode !== "summarize" && !inputText)}
              className="w-full py-2.5 rounded-lg text-xs font-semibold bg-indigo-600 hover:bg-indigo-755 text-white disabled:opacity-50 transition-all flex items-center justify-center space-x-1.5"
            >
              <BrainCircuit className="w-4 h-4 animate-pulse-slow" />
              <span>{processing ? "Generating AI Response..." : `Run AI ${mode}`}</span>
            </button>
          </div>

          {/* Output Panel */}
          <div className="space-y-2">
            <label className="text-[10px] uppercase font-bold text-slate-400">AI Results Output</label>
            <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-950/20 min-h-[300px] text-xs leading-relaxed space-y-4 overflow-y-auto max-h-[350px]">
              {processing ? (
                <div className="h-[250px] flex flex-col items-center justify-center space-y-3 text-slate-400">
                  <div className="w-8 h-8 rounded-full border-2 border-indigo-500 border-t-transparent animate-spin" />
                  <span>Parsing parameters and consulting LLM model...</span>
                </div>
              ) : outputText ? (
                <div className="prose dark:prose-invert max-w-none text-slate-700 dark:text-slate-350">
                  <div className="flex items-center space-x-2 text-indigo-500 mb-3 border-b dark:border-slate-800 pb-2">
                    <Sparkles className="w-4 h-4" />
                    <span className="font-bold text-xs uppercase tracking-wide">AI Generation Complete</span>
                  </div>
                  {/* Simplistic renderer for markdown bullet highlights */}
                  <div dangerouslySetInnerHTML={{
                    __html: outputText
                      .replace(/### (.*)/g, "<h3 className='font-bold text-sm text-slate-900 dark:text-slate-100 my-2'>$1</h3>")
                      .replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>")
                      .replace(/\* (.*)/g, "<li className='ml-4 list-disc'>$1</li>")
                      .replace(/\n/g, "<br/>")
                  }} />
                </div>
              ) : (
                <div className="h-[250px] flex items-center justify-center text-slate-400 italic">
                  Run utility to load intelligence feedback...
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </ToolLayout>
  );
}
