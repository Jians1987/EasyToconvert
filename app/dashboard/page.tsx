"use client";

import React, { useState } from "react";
import { useConversions } from "@/app/providers";
import Link from "next/link";
import {
  TrendingUp,
  FileText,
  Image as ImageIcon,
  Database,
  Code,
  Sparkles,
  RefreshCw,
  Plus,
  Trash2,
  Lock,
  Eye,
  EyeOff,
  Copy,
  Check,
  Star,
  Download
} from "lucide-react";

export default function Dashboard() {
  const { history, clearHistory, favorites, toggleFavorite } = useConversions();
  const [apiKey, setApiKey] = useState("");
  const [showKey, setShowKey] = useState(false);
  const [copied, setCopied] = useState(false);

  const countByCategory = (prefix: string) =>
    history.filter((h) => h.toolType.startsWith(prefix)).length;

  const pdfCount = countByCategory("pdf");
  const imageCount = countByCategory("image");
  const dataCount = countByCategory("data");
  const devCount = countByCategory("dev") + countByCategory("javascript");

  const total = pdfCount + imageCount + dataCount + devCount || 1; // avoid /0

  const generateApiKey = () => {
    const key = "ehp_" + Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
    setApiKey(key);
  };

  const copyToClipboard = () => {
    navigator.clipboard.writeText(apiKey);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const toolCategories = [
    { id: "pdf", name: "PDF Suite", path: "/pdf", icon: FileText, color: "text-red-500 bg-red-50 dark:bg-red-950/20" },
    { id: "image", name: "Image Studio", path: "/image", icon: ImageIcon, color: "text-blue-500 bg-blue-50 dark:bg-blue-950/20" },
    { id: "data", name: "Data Hub", path: "/data", icon: Database, color: "text-emerald-500 bg-emerald-50 dark:bg-emerald-950/20" },
    { id: "developer", name: "Developer Tools", path: "/developer", icon: Code, color: "text-purple-500 bg-purple-50 dark:bg-purple-950/20" },
  ];

  return (
    <div className="space-y-8">
      {/* Welcome Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-extrabold tracking-tight">User Dashboard</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            Manage your recent conversions, API credentials, and favorites.
          </p>
        </div>
        <div className="flex items-center space-x-2">
          <span className="text-xs px-2.5 py-1 rounded-full border border-emerald-200/50 dark:border-emerald-800/40 bg-emerald-50/50 dark:bg-emerald-950/20 text-emerald-600 dark:text-emerald-400 font-semibold flex items-center space-x-1.5">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            <span>Unlimited Free Account</span>
          </span>
        </div>
      </div>

      {/* Grid Dashboard Widgets */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column: Analytics & API credentials */}
        <div className="lg:col-span-2 space-y-6">
          {/* Analytics Widget */}
          <div className="glass-card p-6 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
              <h3 className="font-bold text-sm uppercase tracking-wider text-slate-400 flex items-center space-x-1.5">
                <TrendingUp className="w-4 h-4 text-indigo-500" />
                <span>Conversion Analytics</span>
              </h3>
              <span className="text-[10px] text-slate-400">Updated just now</span>
            </div>

            {/* Live analytics from real history */}
            <div className="space-y-4 pt-2">
              <div className="grid grid-cols-4 gap-4 text-center">
                {[
                  { label: "PDF Tools", count: pdfCount, color: "bg-red-500" },
                  { label: "Images", count: imageCount, color: "bg-blue-500" },
                  { label: "Data", count: dataCount, color: "bg-emerald-500" },
                  { label: "Developer", count: devCount, color: "bg-purple-500" },
                ].map(({ label, count, color }) => (
                  <div key={label} className="p-3 bg-slate-50 dark:bg-slate-900/60 rounded-xl border border-slate-200/40 dark:border-slate-800/40">
                    <span className="text-[10px] text-slate-400 uppercase font-medium">{label}</span>
                    <p className="text-lg font-extrabold text-slate-700 dark:text-slate-200 mt-1">{count}</p>
                    <div className="w-full bg-slate-200 dark:bg-slate-800 h-1.5 rounded-full mt-2 overflow-hidden">
                      <div className={`${color} h-full rounded-full transition-all`} style={{ width: `${Math.min(100, Math.round((count / total) * 100))}%` }} />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* API Key Management */}
          <div className="glass-card p-6 space-y-4">
            <h3 className="font-bold text-sm uppercase tracking-wider text-slate-400">
              API Access Credentials
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Integrate Easytoconvert utility microservices directly into your scripts or pipelines.
            </p>

            <div className="space-y-3">
              {apiKey ? (
                <div className="flex items-center space-x-2">
                  <div className="flex-grow p-2.5 rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 font-mono text-xs break-all flex items-center justify-between">
                    <span>{showKey ? apiKey : "••••••••••••••••••••••••••••••••"}</span>
                    <div className="flex items-center space-x-1.5">
                      <button
                        onClick={() => setShowKey(!showKey)}
                        className="p-1 rounded text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
                      >
                        {showKey ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                      </button>
                      <button
                        onClick={copyToClipboard}
                        className="p-1 rounded text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
                      >
                        {copied ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />}
                      </button>
                    </div>
                  </div>
                  <button
                    onClick={generateApiKey}
                    className="p-2.5 rounded-lg border border-slate-200 dark:border-slate-800 text-xs hover:bg-slate-100 dark:hover:bg-slate-900 transition-all font-semibold"
                  >
                    Regenerate
                  </button>
                </div>
              ) : (
                <button
                  onClick={generateApiKey}
                  className="w-full py-2.5 rounded-lg border border-indigo-500/30 hover:border-indigo-500 text-indigo-500 dark:text-indigo-400 hover:bg-indigo-500/5 transition-all text-xs font-semibold flex items-center justify-center space-x-2"
                >
                  <Plus className="w-4 h-4" />
                  <span>Create API Developer Token</span>
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Right Column: Favorites & Quick Action links */}
        <div className="space-y-6">
          {/* Quick Links */}
          <div className="glass-card p-6 space-y-4">
            <h3 className="font-bold text-sm uppercase tracking-wider text-slate-400">
              Quick Conversion Hubs
            </h3>
            <div className="grid grid-cols-2 gap-3">
              {toolCategories.map((cat) => {
                const Icon = cat.icon;
                return (
                  <Link
                    key={cat.id}
                    href={cat.path}
                    className="p-3 rounded-xl border border-slate-200/50 dark:border-slate-800/80 bg-white/40 dark:bg-slate-900/30 hover:border-indigo-500/30 transition-all flex flex-col items-center justify-center text-center space-y-2 group"
                  >
                    <div className={`p-2 rounded-lg ${cat.color} group-hover:scale-105 transition-all`}>
                      <Icon className="w-4.5 h-4.5" />
                    </div>
                    <span className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                      {cat.name}
                    </span>
                  </Link>
                );
              })}
            </div>
          </div>

          {/* Favorited Tools */}
          <div className="glass-card p-6 space-y-4">
            <h3 className="font-bold text-sm uppercase tracking-wider text-slate-400 flex items-center space-x-1.5">
              <Star className="w-4 h-4 text-amber-500 fill-amber-500" />
              <span>Pinned Tools</span>
            </h3>
            {favorites.length > 0 ? (
              <div className="space-y-2">
                {favorites.map((toolId) => (
                  <div
                    key={toolId}
                    className="p-2 rounded-lg bg-slate-50 dark:bg-slate-950 border border-slate-200/40 dark:border-slate-800 flex items-center justify-between text-xs"
                  >
                    <span className="font-medium capitalize">{toolId.replace("-", " ")}</span>
                    <button
                      onClick={() => toggleFavorite(toolId)}
                      className="text-amber-400 hover:text-slate-400"
                    >
                      <Star className="w-3.5 h-3.5 fill-amber-400" />
                    </button>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-xs text-slate-500 dark:text-slate-400 italic">
                No tools pinned yet. Pin utilities by clicking star badges within each tool route.
              </p>
            )}
          </div>
        </div>
      </div>

      {/* History Area */}
      <div className="glass-card p-6 space-y-6">
        <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-4">
          <div>
            <h3 className="font-bold text-sm uppercase tracking-wider text-slate-400 flex items-center space-x-2">
              <RefreshCw className="w-4 h-4 text-indigo-500 animate-spin-slow" />
              <span>Local Download History</span>
            </h3>
            <p className="text-[10px] text-slate-400 mt-0.5">Showing recent browser operations (privacy focused).</p>
          </div>
          {history.length > 0 && (
            <button
              onClick={clearHistory}
              className="text-xs text-red-500 hover:text-red-600 flex items-center space-x-1"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>Clear History</span>
            </button>
          )}
        </div>

        {history.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-slate-200 dark:border-slate-800 text-slate-400 uppercase text-[10px]">
                  <th className="py-2.5 font-semibold">File Name</th>
                  <th className="py-2.5 font-semibold">Utility</th>
                  <th className="py-2.5 font-semibold">Size</th>
                  <th className="py-2.5 font-semibold">Timestamp</th>
                  <th className="py-2.5 font-semibold">Status</th>
                  <th className="py-2.5 font-semibold text-right">Action</th>
                </tr>
              </thead>
              <tbody>
                {history.map((item) => (
                  <tr key={item.id} className="border-b border-slate-100 dark:border-slate-900">
                    <td className="py-3 font-medium text-slate-700 dark:text-slate-300 truncate max-w-xs">
                      {item.fileName}
                    </td>
                    <td className="py-3 font-medium capitalize text-indigo-500">
                      {item.toolType.replace(/-/g, " ")}
                    </td>
                    <td className="py-3 text-slate-500">
                      {(item.fileSize / 1024).toFixed(1)} KB
                    </td>
                    <td className="py-3 text-slate-400">
                      {new Date(item.timestamp).toLocaleTimeString()}
                    </td>
                    <td className="py-3">
                      <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-emerald-500/10 text-emerald-500">
                        Completed
                      </span>
                    </td>
                    <td className="py-3 text-right">
                      {item.downloadUrl && (
                        <a
                          href={item.downloadUrl}
                          download={item.fileName}
                          className="inline-flex items-center space-x-1 px-2.5 py-1 rounded bg-slate-100 hover:bg-indigo-50 hover:text-indigo-600 dark:bg-slate-900 dark:hover:bg-indigo-950/20 dark:hover:text-indigo-400 border border-slate-200 dark:border-slate-800 transition-all font-semibold"
                        >
                          <Download className="w-3.5 h-3.5" />
                          <span>Fetch</span>
                        </a>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="py-12 text-center text-slate-500 dark:text-slate-400">
            <p className="text-xs">No downloads in history. Your converted files will show up here.</p>
          </div>
        )}
      </div>
    </div>
  );
}
