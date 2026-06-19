"use client";

import React, { useState } from "react";
import ToolLayout from "@/components/ToolLayout";
import { useConversions } from "@/app/providers";
import QRCode from "qrcode";
import { Code, Copy, Check, Star, RefreshCw, AlertCircle } from "lucide-react";

type DevMode = "base64" | "url" | "uuid" | "password" | "qrcode";

export default function DevTools() {
  const [mode, setMode] = useState<DevMode>("base64");
  const [inputText, setInputText] = useState("");
  const [outputText, setOutputText] = useState("");
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  // Password Config
  const [passLength, setPassLength] = useState(16);
  const [includeUpper, setIncludeUpper] = useState(true);
  const [includeNumbers, setIncludeNumbers] = useState(true);
  const [includeSymbols, setIncludeSymbols] = useState(true);

  // QR Code Config
  const [qrUrl, setQrUrl] = useState<string | null>(null);

  const { addHistoryItem, favorites, toggleFavorite } = useConversions();

  const handleBase64 = (action: "encode" | "decode") => {
    setError(null);
    try {
      if (action === "encode") {
        setOutputText(btoa(unescape(encodeURIComponent(inputText))));
      } else {
        setOutputText(decodeURIComponent(escape(atob(inputText))));
      }
      addHistoryItem({
        fileName: `base64_${action}_${Date.now()}.txt`,
        fileSize: inputText.length,
        toolType: "dev-base64",
        status: "success",
      });
    } catch (e) {
      setError("Failed to process Base64. Ensure encoding/decoding constraints match.");
    }
  };

  const handleUrl = (action: "encode" | "decode") => {
    setError(null);
    try {
      if (action === "encode") {
        setOutputText(encodeURIComponent(inputText));
      } else {
        setOutputText(decodeURIComponent(inputText));
      }
      addHistoryItem({
        fileName: `url_${action}_${Date.now()}.txt`,
        fileSize: inputText.length,
        toolType: "dev-url",
        status: "success",
      });
    } catch (e) {
      setError("Failed to encode/decode URL variables.");
    }
  };

  const generateUuid = (count = 5) => {
    const list = [];
    const hex = "0123456789abcdef";
    for (let c = 0; c < count; c++) {
      let r = "";
      for (let i = 0; i < 36; i++) {
        if (i === 8 || i === 13 || i === 18 || i === 23) {
          r += "-";
        } else if (i === 14) {
          r += "4";
        } else {
          r += hex[Math.floor(Math.random() * 16)];
        }
      }
      list.push(r);
    }
    setOutputText(list.join("\n"));
  };

  const generatePassword = () => {
    let chars = "abcdefghijklmnopqrstuvwxyz";
    if (includeUpper) chars += "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
    if (includeNumbers) chars += "0123456789";
    if (includeSymbols) chars += "!@#$%^&*()_+~`|}{[]:;?><,./-=";

    let pass = "";
    for (let i = 0; i < passLength; i++) {
      pass += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    setOutputText(pass);
  };

  const generateQrCode = async () => {
    setError(null);
    setQrUrl(null);
    if (!inputText.trim()) return;

    try {
      const dataUrl = await QRCode.toDataURL(inputText, {
        width: 250,
        margin: 2,
        color: {
          dark: "#000000",
          light: "#ffffff",
        },
      });
      setQrUrl(dataUrl);

      addHistoryItem({
        fileName: `qrcode_${Date.now()}.png`,
        fileSize: inputText.length,
        toolType: "dev-qrcode",
        status: "success",
        downloadUrl: dataUrl,
      });
    } catch (e) {
      setError("Failed to compile QR Code image.");
    }
  };

  const copyToClipboard = () => {
    const target = qrUrl || outputText;
    if (!target) return;
    navigator.clipboard.writeText(outputText);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const isPinned = favorites.includes("dev-tools");

  return (
    <ToolLayout
      title="Developer Utilities Core"
      description="Encode Base64 parameters, package clean URLs, draft UUID sequences, inspect security hashes, and build QR Codes locally."
      category="developer"
    >
      <div className="space-y-6">
        {/* Nav Tabs */}
        <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
          <div className="flex space-x-2 overflow-x-auto scrollbar-none pb-1">
            {[
              { id: "base64", label: "Base64" },
              { id: "url", label: "URL Encode" },
              { id: "uuid", label: "UUID Generator" },
              { id: "password", label: "Password Maker" },
              { id: "qrcode", label: "QR Code Maker" },
            ].map((t) => (
              <button
                key={t.id}
                onClick={() => {
                  setMode(t.id as DevMode);
                  setOutputText("");
                  setInputText("");
                  setQrUrl(null);
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
            onClick={() => toggleFavorite("dev-tools")}
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

        {/* Form elements depending on mode */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Input Side */}
          {mode !== "uuid" && mode !== "password" && (
            <div className="space-y-2">
              <label className="text-[10px] uppercase font-bold text-slate-400">
                {mode === "qrcode" ? "QR Text or URL link" : "Source Input Text"}
              </label>
              <textarea
                rows={8}
                placeholder={mode === "qrcode" ? "https://easytoconvert.com" : "Type string here..."}
                className="w-full font-mono text-xs p-4 glass-input border-slate-300 dark:border-slate-800 resize-none h-[220px]"
                value={inputText}
                onChange={(e) => setInputText(e.target.value)}
              />
            </div>
          )}

          {/* Config fields for generators */}
          {mode === "password" && (
            <div className="space-y-4 p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-white/40 dark:bg-slate-900/30">
              <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400">Settings</h4>
              <div className="space-y-3 text-xs">
                <div className="flex justify-between items-center">
                  <span>Length ({passLength} chars)</span>
                  <input
                    type="range"
                    min="8"
                    max="64"
                    className="accent-indigo-500"
                    value={passLength}
                    onChange={(e) => setPassLength(Number(e.target.value))}
                  />
                </div>
                <label className="flex items-center space-x-2">
                  <input
                    type="checkbox"
                    className="rounded text-indigo-500 focus:ring-indigo-500/50"
                    checked={includeUpper}
                    onChange={(e) => setIncludeUpper(e.target.checked)}
                  />
                  <span>Include Uppercase letters</span>
                </label>
                <label className="flex items-center space-x-2">
                  <input
                    type="checkbox"
                    className="rounded text-indigo-500"
                    checked={includeNumbers}
                    onChange={(e) => setIncludeNumbers(e.target.checked)}
                  />
                  <span>Include Numbers</span>
                </label>
                <label className="flex items-center space-x-2">
                  <input
                    type="checkbox"
                    className="rounded text-indigo-500"
                    checked={includeSymbols}
                    onChange={(e) => setIncludeSymbols(e.target.checked)}
                  />
                  <span>Include Symbols</span>
                </label>
              </div>
            </div>
          )}

          {mode === "uuid" && (
            <div className="space-y-4 p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-white/40 dark:bg-slate-900/30 flex flex-col justify-center">
              <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400">UUID Generator</h4>
              <p className="text-xs text-slate-500 leading-normal">
                Generates random cryptographic UUID Version 4 tokens completely local. Perfect for test databases seeding.
              </p>
            </div>
          )}

          {/* Output Side */}
          <div className="space-y-2">
            <div className="flex justify-between items-center">
              <label className="text-[10px] uppercase font-bold text-slate-400">Result Output</label>
              {outputText && (
                <button
                  onClick={copyToClipboard}
                  className="text-[10px] text-slate-400 hover:text-indigo-500 flex items-center space-x-1 font-semibold"
                >
                  {copied ? <Check className="w-3 h-3 text-emerald-500" /> : <Copy className="w-3 h-3" />}
                  <span>{copied ? "Copied!" : "Copy Result"}</span>
                </button>
              )}
            </div>

            {mode === "qrcode" && qrUrl ? (
              <div className="flex flex-col items-center justify-center p-4 bg-white rounded-xl border border-slate-200 h-[220px]">
                <img src={qrUrl} alt="QR Code Output" className="w-40 h-40" />
                <a
                  href={qrUrl}
                  download="qrcode.png"
                  className="text-[10px] text-indigo-600 hover:underline font-bold mt-2 flex items-center space-x-1"
                >
                  Download PNG QR Image
                </a>
              </div>
            ) : (
              <textarea
                readOnly
                rows={8}
                placeholder="Compiled output will load here..."
                className="w-full font-mono text-xs p-4 glass-input bg-slate-50/50 dark:bg-slate-950/20 border-slate-300 dark:border-slate-800 resize-none h-[220px]"
                value={outputText}
              />
            )}
          </div>
        </div>

        {/* Error Alert */}
        {error && (
          <div className="p-3 bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-900/50 rounded-xl flex items-center space-x-2 text-xs text-red-600 dark:text-red-400">
            <AlertCircle className="w-4 h-4 flex-shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {/* Action Button Controls */}
        <div className="flex gap-2 pt-2">
          {mode === "base64" && (
            <>
              <button
                onClick={() => handleBase64("encode")}
                className="px-5 py-2.5 rounded-lg text-xs font-semibold bg-indigo-600 text-white shadow-md"
              >
                Base64 Encode
              </button>
              <button
                onClick={() => handleBase64("decode")}
                className="px-5 py-2.5 rounded-lg text-xs font-semibold bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 border"
              >
                Base64 Decode
              </button>
            </>
          )}

          {mode === "url" && (
            <>
              <button
                onClick={() => handleUrl("encode")}
                className="px-5 py-2.5 rounded-lg text-xs font-semibold bg-indigo-600 text-white shadow-md"
              >
                URL Encode
              </button>
              <button
                onClick={() => handleUrl("decode")}
                className="px-5 py-2.5 rounded-lg text-xs font-semibold bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 border"
              >
                URL Decode
              </button>
            </>
          )}

          {mode === "uuid" && (
            <button
              onClick={() => generateUuid(5)}
              className="px-5 py-2.5 rounded-lg text-xs font-semibold bg-indigo-600 text-white shadow-md flex items-center space-x-1.5"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              <span>Generate 5 UUIDs</span>
            </button>
          )}

          {mode === "password" && (
            <button
              onClick={generatePassword}
              className="px-5 py-2.5 rounded-lg text-xs font-semibold bg-indigo-600 text-white shadow-md flex items-center space-x-1.5"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              <span>Generate Password</span>
            </button>
          )}

          {mode === "qrcode" && (
            <button
              onClick={generateQrCode}
              className="px-5 py-2.5 rounded-lg text-xs font-semibold bg-indigo-600 text-white shadow-md"
            >
              Create QR Code
            </button>
          )}
        </div>
      </div>
    </ToolLayout>
  );
}
