"use client";

import React from "react";
import { Shield, Sparkles, Zap, Award } from "lucide-react";

export default function About() {
  return (
    <div className="space-y-12 max-w-4xl mx-auto">
      {/* Header */}
      <div className="text-center space-y-4">
        <h1 className="text-3xl md:text-5xl font-extrabold tracking-tight">About Easytoconvert</h1>
        <p className="text-sm md:text-base text-slate-500 dark:text-slate-400 max-w-2xl mx-auto">
          We build utility platforms focused on speed, design aesthetics, and privacy.
        </p>
      </div>

      {/* Main Description */}
      <div className="glass-card p-8 space-y-6">
        <h2 className="text-xl font-bold text-slate-800 dark:text-slate-100">Our Story</h2>
        <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
          Easytoconvert was created to address a simple issue: web utility sites are frequently cluttered with advertisements, track user sessions, and send files to unverified remote servers. 
          We set out to create a dashboard where standard operations (formatting code, extracting zip contents, merging PDF pages, and converting image formats) occur entirely inside the user's browser canvas and JavaScript heap.
        </p>
        <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
          By deploying modern WebAssembly binaries, canvas buffers, and lightweight client-side parsers, we ensure your data never leaves your environment unless you explicitly invoke our AI services.
        </p>
      </div>

      {/* Pillars */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="glass-card p-6 flex space-x-4">
          <div className="p-3 bg-indigo-500/10 text-indigo-500 rounded-xl h-fit">
            <Zap className="w-5 h-5" />
          </div>
          <div className="space-y-1.5">
            <h4 className="text-sm font-bold text-slate-800 dark:text-slate-200">Browser-First Speed</h4>
            <p className="text-xs text-slate-550 text-slate-500 dark:text-slate-400 leading-relaxed">
              No server rounds, no uploads delays. Files compile locally in milliseconds.
            </p>
          </div>
        </div>

        <div className="glass-card p-6 flex space-x-4">
          <div className="p-3 bg-emerald-500/10 text-emerald-500 rounded-xl h-fit">
            <Shield className="w-5 h-5" />
          </div>
          <div className="space-y-1.5">
            <h4 className="text-sm font-bold text-slate-800 dark:text-slate-200">Privacy & Security</h4>
            <p className="text-xs text-slate-550 text-slate-500 dark:text-slate-400 leading-relaxed">
              No cloud logging, tracking, or file caching. Security is built-in.
            </p>
          </div>
        </div>

        <div className="glass-card p-6 flex space-x-4">
          <div className="p-3 bg-amber-500/10 text-amber-500 rounded-xl h-fit">
            <Sparkles className="w-5 h-5" />
          </div>
          <div className="space-y-1.5">
            <h4 className="text-sm font-bold text-slate-800 dark:text-slate-200">Curated Design</h4>
            <p className="text-xs text-slate-550 text-slate-500 dark:text-slate-400 leading-relaxed">
              Glassmorphism panels, harmonious color palettes, responsive sidebars.
            </p>
          </div>
        </div>

        <div className="glass-card p-6 flex space-x-4">
          <div className="p-3 bg-purple-500/10 text-purple-500 rounded-xl h-fit">
            <Award className="w-5 h-5" />
          </div>
          <div className="space-y-1.5">
            <h4 className="text-sm font-bold text-slate-800 dark:text-slate-200">Developer Integrations</h4>
            <p className="text-xs text-slate-550 text-slate-500 dark:text-slate-400 leading-relaxed">
              Clean API routes, mock code generation, schema structures for builders.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
