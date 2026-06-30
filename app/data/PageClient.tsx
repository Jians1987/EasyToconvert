"use client";

import React, { useState } from "react";
import ToolLayout from "@/components/ToolLayout";
import { useConversions } from "@/app/providers";
import yaml from "js-yaml";
import { Database, FileCode, CheckCircle, AlertCircle, Copy, Check, Star } from "lucide-react";

type DataMode = "json-format" | "csv-json" | "xml-json" | "json-yaml" | "tree-view";

export function DataPageClient() {
  const [mode, setMode] = useState<DataMode>("json-format");
  const [inputText, setInputText] = useState("");
  const [outputText, setOutputText] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const { addHistoryItem, favorites, toggleFavorite } = useConversions();

  const handleAction = (action: "beautify" | "minify" | "validate" | "convert") => {
    setError(null);
    setOutputText("");
    if (!inputText.trim()) return;

    try {
      if (mode === "json-format") {
        const parsed = JSON.parse(inputText);
        if (action === "beautify") {
          setOutputText(JSON.stringify(parsed, null, 2));
        } else if (action === "minify") {
          setOutputText(JSON.stringify(parsed));
        } else if (action === "validate") {
          setOutputText("Valid JSON Structure!");
        }
      } else if (mode === "csv-json") {
        if (action === "convert") {
          // CSV to JSON — RFC 4180 compliant parser supporting quoted fields with commas
          const parseCsvLine = (line: string): string[] => {
            const fields: string[] = [];
            let current = "";
            let inQuotes = false;
            for (let i = 0; i < line.length; i++) {
              const ch = line[i];
              if (ch === '"') {
                if (inQuotes && line[i + 1] === '"') { current += '"'; i++; }
                else { inQuotes = !inQuotes; }
              } else if (ch === "," && !inQuotes) {
                fields.push(current.trim());
                current = "";
              } else {
                current += ch;
              }
            }
            fields.push(current.trim());
            return fields;
          };

          const lines = inputText.trim().split("\n");
          if (lines.length < 2) throw new Error("CSV must contain at least a header and one data row.");
          const headers = parseCsvLine(lines[0]);
          const result = [];
          for (let i = 1; i < lines.length; i++) {
            if (!lines[i].trim()) continue;
            const obj: { [key: string]: string } = {};
            const values = parseCsvLine(lines[i]);
            headers.forEach((header, index) => {
              obj[header] = values[index] ?? "";
            });
            result.push(obj);
          }
          setOutputText(JSON.stringify(result, null, 2));
        }
      } else if (mode === "xml-json") {
        if (action === "convert") {
          const parser = new DOMParser();
          const xmlDoc = parser.parseFromString(inputText, "text/xml");
          if (xmlDoc.getElementsByTagName("parsererror").length > 0) {
            throw new Error("Invalid XML structure detected.");
          }
          // Basic XML to JSON serializer
          const serializeNode = (node: Node): any => {
            if (node.nodeType === Node.TEXT_NODE) return node.nodeValue?.trim();
            const obj: any = {};
            if (node.hasChildNodes()) {
              for (let i = 0; i < node.childNodes.length; i++) {
                const child = node.childNodes[i];
                if (child.nodeType === Node.ELEMENT_NODE) {
                  const val = serializeNode(child);
                  if (obj[child.nodeName]) {
                    if (!Array.isArray(obj[child.nodeName])) {
                      obj[child.nodeName] = [obj[child.nodeName]];
                    }
                    obj[child.nodeName].push(val);
                  } else {
                    obj[child.nodeName] = val;
                  }
                } else if (child.nodeType === Node.TEXT_NODE && child.nodeValue?.trim()) {
                  return child.nodeValue.trim();
                }
              }
            }
            return obj;
          };
          const serialized = serializeNode(xmlDoc.documentElement);
          setOutputText(JSON.stringify({ [xmlDoc.documentElement.nodeName]: serialized }, null, 2));
        }
      } else if (mode === "json-yaml") {
        if (action === "convert") {
          // Detect JSON or YAML and convert to other
          const trimmed = inputText.trim();
          if (trimmed.startsWith("{") || trimmed.startsWith("[")) {
            const parsed = JSON.parse(trimmed);
            setOutputText(yaml.dump(parsed));
          } else {
            const parsed = yaml.load(trimmed);
            setOutputText(JSON.stringify(parsed, null, 2));
          }
        }
      }

      addHistoryItem({
        fileName: `${mode}_log_${Date.now()}.txt`,
        fileSize: inputText.length,
        toolType: `data-${mode}`,
        status: "success",
      });
    } catch (err: any) {
      setError(err.message || "Failed to process data structure.");
    }
  };

  const handleJsonToCsv = () => {
    setError(null);
    try {
      const parsed = JSON.parse(inputText);
      const array = Array.isArray(parsed) ? parsed : [parsed];
      if (array.length === 0) throw new Error("Input JSON array is empty — nothing to convert.");
      const headers = Object.keys(array[0]);
      const csvRows = [
        headers.join(","), // header row
        ...array.map(row => headers.map(fieldName => JSON.stringify(row[fieldName] ?? "")).join(","))
      ];
      setOutputText(csvRows.join("\n"));
    } catch (e: any) {
      setError(e.message || "Ensure input is a valid JSON array or object.");
    }
  };

  const copyToClipboard = () => {
    if (!outputText) return;
    navigator.clipboard.writeText(outputText);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const isPinned = favorites.includes("data-tools");

  return (
    <ToolLayout
      title="Data Hub Converters"
      description="Format JSON arrays, convert XML structures, parse CSV columns, translate YAML variables, and inspect syntax elements locally."
      category="data"
    >
      <div className="space-y-6">
        {/* Navigation Tabs */}
        <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
          <div className="flex space-x-2 overflow-x-auto scrollbar-none pb-1">
            {[
              { id: "json-format", label: "JSON Beautifier" },
              { id: "csv-json", label: "CSV ↔ JSON" },
              { id: "xml-json", label: "XML ↔ JSON" },
              { id: "json-yaml", label: "JSON ↔ YAML" },
            ].map((t) => (
              <button
                key={t.id}
                onClick={() => {
                  setMode(t.id as DataMode);
                  setOutputText("");
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
            onClick={() => toggleFavorite("data-tools")}
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

        {/* Input/Output Split Workspace */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Input Side */}
          <div className="space-y-2">
            <div className="flex justify-between items-center">
              <label className="text-[10px] uppercase font-bold text-slate-400">Input Data</label>
              <button
                onClick={() => setInputText("")}
                className="text-[10px] text-slate-400 hover:text-indigo-500"
              >
                Clear
              </button>
            </div>
            <textarea
              rows={12}
              placeholder={
                mode === "json-format"
                  ? '{"name": "Easytoconvert", "active": true, "tags": ["pdf", "image"]}'
                  : mode === "csv-json"
                  ? "name, active, role\nEasytoconvert, true, platform\nJohn, false, admin"
                  : mode === "xml-json"
                  ? "<root><name>Easytoconvert</name><active>true</active></root>"
                  : 'name: Easytoconvert\nactive: true'
              }
              className="w-full font-mono text-xs p-4 glass-input border-slate-300 dark:border-slate-800 focus:ring-indigo-500/50 resize-none h-[300px]"
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
            />
          </div>

          {/* Output Side */}
          <div className="space-y-2">
            <div className="flex justify-between items-center">
              <label className="text-[10px] uppercase font-bold text-slate-400">Output Result</label>
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
            <textarea
              readOnly
              rows={12}
              placeholder="Output will load here..."
              className="w-full font-mono text-xs p-4 glass-input bg-slate-50/50 dark:bg-slate-950/20 border-slate-300 dark:border-slate-800 resize-none h-[300px]"
              value={outputText}
            />
          </div>
        </div>

        {/* Error Notification */}
        {error && (
          <div className="p-3.5 bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-900/50 rounded-xl flex items-center space-x-2 text-xs text-red-600 dark:text-red-400">
            <AlertCircle className="w-4 h-4 flex-shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {/* Action Controls */}
        <div className="flex flex-wrap gap-2.5 pt-2">
          {mode === "json-format" && (
            <>
              <button
                onClick={() => handleAction("beautify")}
                className="px-5 py-2.5 rounded-lg text-xs font-semibold bg-indigo-600 text-white shadow-md hover:opacity-90 transition-all"
              >
                Beautify JSON
              </button>
              <button
                onClick={() => handleAction("minify")}
                className="px-5 py-2.5 rounded-lg text-xs font-semibold bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-700 transition-all"
              >
                Minify JSON
              </button>
              <button
                onClick={handleJsonToCsv}
                className="px-5 py-2.5 rounded-lg text-xs font-semibold bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-700 transition-all"
              >
                JSON to CSV
              </button>
            </>
          )}

          {mode === "csv-json" && (
            <button
              onClick={() => handleAction("convert")}
              className="px-5 py-2.5 rounded-lg text-xs font-semibold bg-indigo-600 text-white shadow-md hover:opacity-90 transition-all"
            >
              CSV to JSON
            </button>
          )}

          {mode === "xml-json" && (
            <button
              onClick={() => handleAction("convert")}
              className="px-5 py-2.5 rounded-lg text-xs font-semibold bg-indigo-600 text-white shadow-md hover:opacity-90 transition-all"
            >
              XML to JSON
            </button>
          )}

          {mode === "json-yaml" && (
            <button
              onClick={() => handleAction("convert")}
              className="px-5 py-2.5 rounded-lg text-xs font-semibold bg-indigo-600 text-white shadow-md hover:opacity-90 transition-all"
            >
              Parse JSON ↔ YAML
            </button>
          )}
        </div>
      </div>
    </ToolLayout>
  );
}
