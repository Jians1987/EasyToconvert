"use client";

import React, { useState } from "react";
import ToolLayout from "@/components/ToolLayout";
import { useConversions } from "@/app/providers";
import { Sliders, Copy, Check, Star, RefreshCw, Layers } from "lucide-react";

type CodeMode = "gradient" | "shadow" | "minify" | "html-beautify";

export default function JavascriptTools() {
  const [mode, setMode] = useState<CodeMode>("gradient");
  const [copied, setCopied] = useState(false);
  const { addHistoryItem, favorites, toggleFavorite } = useConversions();

  // Gradient Config
  const [color1, setColor1] = useState("#6366f1");
  const [color2, setColor2] = useState("#a855f7");
  const [angle, setAngle] = useState(135);

  // Shadow Config
  const [hOffset, setHOffset] = useState(10);
  const [vOffset, setVOffset] = useState(10);
  const [blur, setBlur] = useState(20);
  const [spread, setSpread] = useState(0);
  const [shadowColor, setShadowColor] = useState("#6366f1");
  const [shadowOpacity, setShadowOpacity] = useState(40); // 0-100

  // Minifier Config
  const [inputText, setInputText] = useState("");
  const [outputText, setOutputText] = useState("");
  const [codeType, setCodeType] = useState<"js" | "html" | "css">("js");

  const getGradientCss = () => {
    return `background: linear-gradient(${angle}deg, ${color1}, ${color2});`;
  };

  const getShadowCss = () => {
    // hex to rgba opacity conversion
    const hex = shadowColor.replace("#", "");
    const r = parseInt(hex.substring(0, 2), 16) || 0;
    const g = parseInt(hex.substring(2, 4), 16) || 0;
    const b = parseInt(hex.substring(4, 6), 16) || 0;
    const alpha = (shadowOpacity / 100).toFixed(2);
    return `box-shadow: ${hOffset}px ${vOffset}px ${blur}px ${spread}px rgba(${r}, ${g}, ${b}, ${alpha});`;
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleMinify = () => {
    if (!inputText.trim()) return;
    let minified = "";
    if (codeType === "js" || codeType === "css") {
      // Basic minify - remove comments, newlines and extra spaces
      minified = inputText
        .replace(/\/\*[\s\S]*?\*\/|([^\\:]|^)\/\/.*$/gm, "$1") // comments
        .replace(/\s+/g, " ")
        .replace(/\s*([\{\}\:\;\,\(\)\=\+\-\*\/])\s*/g, "$1")
        .trim();
    } else {
      // HTML minify
      minified = inputText
        .replace(/<!--[\s\S]*?-->/g, "")
        .replace(/\s+/g, " ")
        .replace(/>\s+</g, "><")
        .trim();
    }
    setOutputText(minified);

    addHistoryItem({
      fileName: `minified_${codeType}_${Date.now()}.txt`,
      fileSize: inputText.length,
      toolType: `javascript-minify-${codeType}`,
      status: "success",
    });
  };

  const handleHtmlBeautify = () => {
    if (!inputText.trim()) return;
    // Simple basic HTML tag indent beautifier
    let formatted = "";
    let indent = 0;
    const tokens = inputText.replace(/>\s*</g, "><").split(/(?=<)|(?<=>)/);
    
    for (let i = 0; i < tokens.length; i++) {
      const token = tokens[i].trim();
      if (!token) continue;
      
      if (token.startsWith("</")) {
        indent = Math.max(0, indent - 1);
      }
      
      formatted += "  ".repeat(indent) + token + "\n";
      
      if (token.startsWith("<") && !token.startsWith("</") && !token.endsWith("/>") && !token.startsWith("<!")) {
        // Avoid self-closing tags or doctypes
        const isSelfClosing = /^(?:img|br|hr|input|link|meta)/i.test(token.replace(/[<>]/g, "").split(" ")[0]);
        if (!isSelfClosing) {
          indent++;
        }
      }
    }
    setOutputText(formatted.trim());

    addHistoryItem({
      fileName: `beautified_html_${Date.now()}.html`,
      fileSize: inputText.length,
      toolType: "javascript-html-beautify",
      status: "success",
    });
  };

  const isPinned = favorites.includes("javascript-tools");

  return (
    <ToolLayout
      title="Code & Styling Utilities"
      description="Design CSS box shadows, assemble gradients with hex overlays, format HTML blocks, and minify JavaScript structures locally."
      category="javascript"
    >
      <div className="space-y-6">
        {/* Nav Tabs */}
        <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
          <div className="flex space-x-2">
            {[
              { id: "gradient", label: "CSS Gradient" },
              { id: "shadow", label: "Box Shadow" },
              { id: "minify", label: "Minifier" },
              { id: "html-beautify", label: "HTML Beautifier" },
            ].map((t) => (
              <button
                key={t.id}
                onClick={() => {
                  setMode(t.id as CodeMode);
                  setOutputText("");
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
            onClick={() => toggleFavorite("javascript-tools")}
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

        {/* 1. CSS Gradient Workspace */}
        {mode === "gradient" && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-center">
            {/* Config Controls */}
            <div className="space-y-4 p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-white/40 dark:bg-slate-900/30">
              <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400">Settings</h4>
              <div className="space-y-3.5 text-xs">
                <div className="flex justify-between items-center">
                  <span>Color 1</span>
                  <input
                    type="color"
                    className="w-10 h-7 rounded cursor-pointer border bg-transparent"
                    value={color1}
                    onChange={(e) => setColor1(e.target.value)}
                  />
                </div>
                <div className="flex justify-between items-center">
                  <span>Color 2</span>
                  <input
                    type="color"
                    className="w-10 h-7 rounded cursor-pointer border bg-transparent"
                    value={color2}
                    onChange={(e) => setColor2(e.target.value)}
                  />
                </div>
                <div className="flex justify-between items-center">
                  <span>Angle ({angle}°)</span>
                  <input
                    type="range"
                    min="0"
                    max="360"
                    className="accent-indigo-500"
                    value={angle}
                    onChange={(e) => setAngle(Number(e.target.value))}
                  />
                </div>
              </div>
            </div>

            {/* Live Preview Card */}
            <div className="space-y-3 text-center">
              <div
                className="w-full h-36 rounded-xl border border-slate-200 dark:border-slate-800 shadow-lg"
                style={{ background: `linear-gradient(${angle}deg, ${color1}, ${color2})` }}
              />
              <div className="p-2 rounded-lg bg-slate-900 text-slate-100 font-mono text-[10px] flex justify-between items-center">
                <span className="truncate max-w-xs">{getGradientCss()}</span>
                <button
                  onClick={() => copyToClipboard(getGradientCss())}
                  className="p-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white"
                >
                  {copied ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* 2. Box Shadow Workspace */}
        {mode === "shadow" && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-center">
            {/* Settings */}
            <div className="space-y-4 p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-white/40 dark:bg-slate-900/30">
              <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400">Sliders</h4>
              <div className="space-y-3 text-xs">
                <div className="flex justify-between items-center">
                  <span>Horiz. Offset ({hOffset}px)</span>
                  <input
                    type="range"
                    min="-50"
                    max="50"
                    className="accent-indigo-500"
                    value={hOffset}
                    onChange={(e) => setHOffset(Number(e.target.value))}
                  />
                </div>
                <div className="flex justify-between items-center">
                  <span>Vert. Offset ({vOffset}px)</span>
                  <input
                    type="range"
                    min="-50"
                    max="50"
                    className="accent-indigo-500"
                    value={vOffset}
                    onChange={(e) => setVOffset(Number(e.target.value))}
                  />
                </div>
                <div className="flex justify-between items-center">
                  <span>Blur Radius ({blur}px)</span>
                  <input
                    type="range"
                    min="0"
                    max="100"
                    className="accent-indigo-500"
                    value={blur}
                    onChange={(e) => setBlur(Number(e.target.value))}
                  />
                </div>
                <div className="flex justify-between items-center">
                  <span>Spread Radius ({spread}px)</span>
                  <input
                    type="range"
                    min="-30"
                    max="30"
                    className="accent-indigo-500"
                    value={spread}
                    onChange={(e) => setSpread(Number(e.target.value))}
                  />
                </div>
                <div className="flex justify-between items-center">
                  <span>Shadow Color</span>
                  <input
                    type="color"
                    className="w-10 h-7 rounded border bg-transparent"
                    value={shadowColor}
                    onChange={(e) => setShadowColor(e.target.value)}
                  />
                </div>
                <div className="flex justify-between items-center">
                  <span>Opacity ({shadowOpacity}%)</span>
                  <input
                    type="range"
                    min="0"
                    max="100"
                    className="accent-indigo-500"
                    value={shadowOpacity}
                    onChange={(e) => setShadowOpacity(Number(e.target.value))}
                  />
                </div>
              </div>
            </div>

            {/* Live Preview Shadow Card */}
            <div className="space-y-6 flex flex-col items-center">
              <div className="w-full h-36 flex items-center justify-center bg-slate-50 dark:bg-slate-950 rounded-xl border border-slate-200/50 dark:border-slate-800/50">
                <div
                  className="w-24 h-16 bg-white dark:bg-slate-900 border border-slate-250 dark:border-slate-800 rounded-lg transition-all"
                  style={{
                    boxShadow: `${hOffset}px ${vOffset}px ${blur}px ${spread}px rgba(${
                      parseInt(shadowColor.substring(1, 3), 16) || 0
                    }, ${parseInt(shadowColor.substring(3, 5), 16) || 0}, ${
                      parseInt(shadowColor.substring(5, 7), 16) || 0
                    }, ${shadowOpacity / 100})`,
                  }}
                />
              </div>
              <div className="w-full p-2 rounded-lg bg-slate-900 text-slate-100 font-mono text-[10px] flex justify-between items-center">
                <span className="truncate max-w-xs">{getShadowCss()}</span>
                <button
                  onClick={() => copyToClipboard(getShadowCss())}
                  className="p-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white"
                >
                  {copied ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* 3. Minifier/Beautifier Textareas */}
        {mode !== "gradient" && mode !== "shadow" && (
          <div className="space-y-4">
            {mode === "minify" && (
              <div className="flex space-x-2">
                {(["js", "html", "css"] as const).map((t) => (
                  <button
                    key={t}
                    onClick={() => setCodeType(t)}
                    className={`px-3 py-1 rounded text-xs font-semibold capitalize border ${
                      codeType === t
                        ? "border-indigo-500 bg-indigo-50/10 text-indigo-500"
                        : "border-slate-250 dark:border-slate-800 hover:border-slate-350"
                    }`}
                  >
                    {t.toUpperCase()}
                  </button>
                ))}
              </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-2">
                <label className="text-[10px] uppercase font-bold text-slate-400">Source Code Input</label>
                <textarea
                  rows={10}
                  placeholder="Paste your source file here..."
                  className="w-full font-mono text-xs p-4 glass-input border-slate-300 dark:border-slate-800 resize-none h-[220px]"
                  value={inputText}
                  onChange={(e) => setInputText(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <div className="flex justify-between items-center">
                  <label className="text-[10px] uppercase font-bold text-slate-400">Output Result</label>
                  {outputText && (
                    <button
                      onClick={() => copyToClipboard(outputText)}
                      className="text-[10px] text-slate-400 hover:text-indigo-500 flex items-center space-x-1 font-semibold"
                    >
                      {copied ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />}
                      <span>{copied ? "Copied!" : "Copy Result"}</span>
                    </button>
                  )}
                </div>
                <textarea
                  readOnly
                  rows={10}
                  placeholder="Output code will render here..."
                  className="w-full font-mono text-xs p-4 glass-input bg-slate-50/50 dark:bg-slate-950/20 border-slate-300 dark:border-slate-800 resize-none h-[220px]"
                  value={outputText}
                />
              </div>
            </div>

            <div className="pt-2">
              <button
                onClick={mode === "minify" ? handleMinify : handleHtmlBeautify}
                className="px-6 py-2.5 rounded-lg text-xs font-semibold bg-indigo-650 bg-indigo-600 text-white shadow-md"
              >
                {mode === "minify" ? `Apply ${codeType.toUpperCase()} Minification` : "Beautify HTML Code"}
              </button>
            </div>
          </div>
        )}
      </div>
    </ToolLayout>
  );
}
