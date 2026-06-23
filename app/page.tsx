"use client";

import React, { useState } from "react";
import Link from "next/link";
import {
  FileText,
  Image as ImageIcon,
  Database,
  Code,
  Sparkles,
  Video,
  ChevronRight,
  TrendingUp,
  Shield,
  Zap,
  Users,
  Search,
  CheckCircle,
  Star
} from "lucide-react";

export default function LandingPage() {
  const [searchQuery, setSearchQuery] = useState("");

  const categories = [
    {
      id: "pdf",
      title: "PDF Utilities",
      icon: FileText,
      color: "from-red-500/20 to-orange-500/20 text-red-500 border-red-500/30",
      description: "Merge, split, rotate, protect, and convert PDF files to Word or JPG images directly in your browser.",
      tools: ["Merge PDF", "Split PDF", "Rotate PDF", "PDF to JPG", "PDF to Word", "Protect PDF"],
      path: "/pdf",
    },
    {
      id: "image",
      title: "Image Studio",
      icon: ImageIcon,
      color: "from-blue-500/20 to-indigo-500/20 text-blue-500 border-blue-500/30",
      description: "Compress, resize, read metadata, and convert PNG to JPG, WebP, and SVG formats.",
      tools: ["PNG to JPG", "Compress Image", "Image Metadata", "Resize Image", "SVG to PNG"],
      path: "/image",
    },
    {
      id: "data",
      title: "Data Converters",
      icon: Database,
      color: "from-emerald-500/20 to-teal-500/20 text-emerald-500 border-emerald-500/30",
      description: "JSON formatting, minifying, validation, plus CSV, XML, and YAML conversion.",
      tools: ["JSON Formatter", "CSV to JSON", "XML to JSON", "JSON to YAML", "JSON Minifier"],
      path: "/data",
    },
    {
      id: "developer",
      title: "Developer Core",
      icon: Code,
      color: "from-purple-500/20 to-pink-500/20 text-purple-500 border-purple-500/30",
      description: "Base64 & URL encoding, UUID generators, password builders, and QR code makers.",
      tools: ["Base64 Encode", "URL Encoder", "UUID Generator", "QR Code", "Password Maker"],
      path: "/developer",
    },
    {
      id: "javascript",
      title: "JS & HTML/CSS",
      icon: Code,
      color: "from-amber-500/20 to-yellow-500/20 text-amber-500 border-amber-500/30",
      description: "Minify JS, HTML & CSS, beautify HTML, and generate CSS gradients and box shadows.",
      tools: ["JS Minifier", "HTML Beautifier", "CSS Minifier", "CSS Gradient Generator", "Box Shadow"],
      path: "/javascript",
    },
    {
      id: "ai",
      title: "AI Powerhouse",
      icon: Sparkles,
      color: "from-violet-500/20 to-fuchsia-500/20 text-violet-500 border-violet-500/30",
      description: "Summarize PDF documents, translate text, and explain source code in a demo AI workspace.",
      tools: ["AI Summarizer", "AI Code Explainer", "Document Translator"],
      path: "/ai",
    },
    {
      id: "media",
      title: "Video & Audio",
      icon: Video,
      color: "from-cyan-500/20 to-sky-500/20 text-cyan-500 border-cyan-500/30",
      description: "Video and audio tools — compress media, extract audio, and trim clips. Coming soon.",
      tools: ["MP4 to GIF", "Video Compressor", "Extract Audio", "Audio Cutter"],
      path: "/media",
      comingSoon: true,
    },
  ];

  // Filtering based on search query
  const filteredCategories = searchQuery
    ? categories.filter(
        (cat) =>
          cat.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
          cat.tools.some((t) => t.toLowerCase().includes(searchQuery.toLowerCase()))
      )
    : categories;

  return (
    <div className="space-y-20">
      {/* 1. Hero Section */}
      <section className="text-center py-12 md:py-20 relative overflow-hidden">
        {/* Glow Effects */}
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] bg-indigo-500/10 dark:bg-indigo-500/5 rounded-full blur-[100px] pointer-events-none -z-10 animate-pulse-slow" />

        <div className="space-y-6 max-w-4xl mx-auto">
          {/* Tag */}
          <div className="inline-flex items-center space-x-2 px-3 py-1.5 rounded-full bg-indigo-50/50 dark:bg-slate-900/50 border border-indigo-200/50 dark:border-indigo-800/30 text-xs font-semibold text-indigo-600 dark:text-indigo-400">
            <Sparkles className="w-3.5 h-3.5" />
            <span>All Utilities In One Dashboard</span>
          </div>

          {/* Heading */}
          <h1 className="text-4xl md:text-6xl font-extrabold tracking-tight leading-[1.1] bg-clip-text text-transparent bg-gradient-to-r from-slate-950 via-slate-800 to-indigo-600 dark:from-white dark:via-slate-200 dark:to-indigo-400">
            Smart File Conversion & <br />
            <span className="bg-clip-text text-transparent bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500">
              Developer Utilities
            </span>
          </h1>

          {/* Subheading */}
          <p className="text-base md:text-xl text-slate-500 dark:text-slate-400 max-w-2xl mx-auto leading-relaxed">
            Easytoconvert is a privacy-first web workspace offering image compression, PDF compilers, data formatters, encoders, generators, and smart AI capabilities.
          </p>

          {/* Interactive Search Area */}
          <div className="max-w-xl mx-auto pt-4 px-4">
            <div className="relative glass-card p-1.5 flex items-center border-slate-300/80 dark:border-slate-800 shadow-2xl">
              <Search className="w-5 h-5 text-slate-400 ml-3" />
              <input
                type="text"
                placeholder="Search PDF to Word, Image compression, QR code, Base64..."
                className="flex-grow bg-transparent text-sm py-2.5 px-3 outline-none placeholder-slate-400"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
              <button className="px-5 py-2.5 rounded-lg text-sm font-semibold bg-gradient-to-r from-indigo-600 to-purple-600 text-white shadow-md hover:opacity-90 transition-all flex items-center space-x-1">
                <span>Find</span>
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* 2. Conversion Categories Grid */}
      <section className="space-y-8">
        <div className="text-center space-y-2">
          <h2 className="text-2xl md:text-3xl font-extrabold text-slate-800 dark:text-slate-100">
            Explore All Utility Hubs
          </h2>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            Select a suite below to begin formatting or converting your files instantly.
          </p>
        </div>

        {searchQuery && filteredCategories.length === 0 && (
          <div className="text-center py-10 text-slate-400 text-sm">
            No tools found for &ldquo;{searchQuery}&rdquo;. Try a different keyword.
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredCategories.map((cat) => {
            const Icon = cat.icon;
            return (
              <div
                key={cat.id}
                className="glass-card glass-card-hover p-6 flex flex-col justify-between"
              >
                <div className="space-y-4">
                  {/* Category Header */}
                  <div className="flex items-center space-x-3">
                    <div className={`p-2.5 rounded-xl border bg-gradient-to-br ${cat.color}`}>
                      <Icon className="w-5 h-5" />
                    </div>
                    <h3 className="text-lg font-bold text-slate-800 dark:text-slate-100">
                      {cat.title}
                    </h3>
                    {cat.comingSoon && (
                      <span className="text-[9px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-500 border border-amber-500/30">
                        Soon
                      </span>
                    )}
                  </div>

                  {/* Description */}
                  <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
                    {cat.description}
                  </p>

                  {/* List of Key Tools */}
                  <div className="flex flex-wrap gap-1.5 pt-2">
                    {cat.tools.map((tool) => (
                      <Link
                        key={tool}
                        href={cat.path}
                        className="text-[10px] bg-slate-100 hover:bg-slate-200 dark:bg-slate-800/80 dark:hover:bg-slate-800 border border-slate-200/50 dark:border-slate-700/50 rounded-full px-2.5 py-0.5 text-slate-600 dark:text-slate-300 font-medium transition-colors cursor-pointer"
                      >
                        {tool}
                      </Link>
                    ))}
                  </div>
                </div>

                {/* Footer Action */}
                <div className="pt-6 mt-6 border-t border-slate-100 dark:border-slate-800/60">
                  <Link
                    href={cat.path}
                    className="w-full py-2 rounded-lg text-xs font-semibold bg-slate-100 hover:bg-indigo-50 hover:text-indigo-600 dark:bg-slate-900 dark:hover:bg-indigo-950/20 dark:hover:text-indigo-400 border border-slate-200/40 dark:border-slate-800 transition-all flex items-center justify-center space-x-1"
                  >
                    <span>Launch {cat.title}</span>
                    <ChevronRight className="w-3.5 h-3.5" />
                  </Link>
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* 3. Core Platforms Statistics */}
      <section className="p-8 md:p-12 rounded-2xl border border-slate-200/60 dark:border-slate-800/80 bg-white/40 dark:bg-slate-900/10 backdrop-blur-md relative overflow-hidden">
        <div className="absolute top-1/2 left-1/3 -translate-x-1/2 -translate-y-1/2 w-64 h-64 bg-purple-500/10 dark:bg-purple-500/5 rounded-full blur-[70px] pointer-events-none -z-10" />

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 text-center">
          <div className="space-y-2">
            <div className="p-3 rounded-full bg-indigo-500/10 text-indigo-500 w-fit mx-auto">
              <Zap className="w-6 h-6" />
            </div>
            <h3 className="text-3xl font-extrabold text-slate-800 dark:text-slate-100">0.02s</h3>
            <p className="text-xs text-slate-400">Average Local Render Latency</p>
          </div>
          <div className="space-y-2">
            <div className="p-3 rounded-full bg-emerald-500/10 text-emerald-500 w-fit mx-auto">
              <Shield className="w-6 h-6" />
            </div>
            <h3 className="text-3xl font-extrabold text-slate-800 dark:text-slate-100">100%</h3>
            <p className="text-xs text-slate-400">Privacy & Local Processing</p>
          </div>
          <div className="space-y-2">
            <div className="p-3 rounded-full bg-purple-500/10 text-purple-500 w-fit mx-auto">
              <Users className="w-6 h-6" />
            </div>
            <h3 className="text-3xl font-extrabold text-slate-800 dark:text-slate-100">5M+</h3>
            <p className="text-xs text-slate-400">Mock Conversions Completed</p>
          </div>
        </div>
      </section>

      {/* 4. Testimonials & Trust */}
      <section className="space-y-8">
        <div className="text-center space-y-2">
          <h2 className="text-2xl md:text-3xl font-extrabold text-slate-800 dark:text-slate-100">
            Trusted by Builders Worldwide
          </h2>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            See what digital creators and developers say about our responsive workspace.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {[
            {
              text: "Easytoconvert replaced five other web utility sites I had bookmarked. The JSON tree checker and JWT decoder work instantly client-side without any latency.",
              author: "Sarah Chen",
              role: "Full Stack Engineer",
              avatar: "SC"
            },
            {
              text: "The local image compressor is amazing. I can drop 20 screenshots and convert them to optimized WebP in bulk. It is extremely fast and privacy-focused.",
              author: "Marcus Vance",
              role: "Content Creator",
              avatar: "MV"
            },
            {
              text: "PDF merge and rotations work completely within my browser. There's no risk of sending sensitive contracts to a random server, which is crucial for my legal clients.",
              author: "Helena Rostova",
              role: "IT Security Audit",
              avatar: "HR"
            }
          ].map((t, idx) => (
            <div key={idx} className="glass-card p-6 space-y-4">
              <div className="flex text-amber-400">
                {[...Array(5)].map((_, i) => (
                  <Star key={i} className="w-3.5 h-3.5 fill-amber-400" />
                ))}
              </div>
              <p className="text-xs text-slate-600 dark:text-slate-300 italic leading-relaxed">
                &ldquo;{t.text}&rdquo;
              </p>
              <div className="flex items-center space-x-2.5 pt-2">
                <span className="w-8 h-8 rounded-full bg-gradient-to-tr from-indigo-500 to-purple-500 flex items-center justify-center text-xs font-bold text-white">
                  {t.avatar}
                </span>
                <div>
                  <h4 className="text-xs font-bold text-slate-800 dark:text-slate-200">{t.author}</h4>
                  <span className="text-[10px] text-slate-400">{t.role}</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* 5. CTA Section */}
      <section className="text-center py-12 rounded-3xl bg-gradient-to-r from-indigo-600 via-purple-600 to-pink-600 text-white relative overflow-hidden shadow-2xl">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-white/10 via-transparent to-transparent" />
        <div className="space-y-6 max-w-2xl mx-auto relative z-10 px-4">
          <h2 className="text-3xl md:text-4xl font-extrabold">Ready to Boost Your Productivity?</h2>
          <p className="text-sm text-indigo-100 max-w-md mx-auto leading-relaxed">
            Access every file utility and formatting module under a single, unified premium interface. Start free.
          </p>
          <div className="flex flex-col sm:flex-row justify-center items-center gap-3 pt-2">
            <Link
              href="/dashboard"
              className="px-6 py-3 rounded-xl bg-white text-indigo-600 font-semibold shadow-lg hover:bg-slate-50 transition-all w-full sm:w-auto"
            >
              Go to Dashboard
            </Link>
            <Link
              href="/developer"
              className="px-6 py-3 rounded-xl border border-white/40 hover:bg-white/10 font-semibold transition-all w-full sm:w-auto"
            >
              Explore Dev Tools
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}
