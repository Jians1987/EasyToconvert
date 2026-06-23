"use client";

import React, { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import ThemeToggle from "./ThemeToggle";
import { Menu, X, Command, Search, Sparkles, LayoutDashboard, Database, FileText, Image as ImageIcon, Code, Settings } from "lucide-react";

export default function Navbar() {
  const [isOpen, setIsOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const router = useRouter();

  // Simple static list of tools for quick searching
  const toolsList = [
    { name: "Merge PDF", url: "/pdf" },
    { name: "Split PDF", url: "/pdf" },
    { name: "Rotate PDF", url: "/pdf" },
    { name: "PDF to Word", url: "/pdf" },
    { name: "PDF to Image", url: "/pdf" },
    { name: "JPG to PNG", url: "/image" },
    { name: "PNG to JPG", url: "/image" },
    { name: "WebP Converter", url: "/image" },
    { name: "Resize Image", url: "/image" },
    { name: "JSON Formatter", url: "/data" },
    { name: "CSV to JSON", url: "/data" },
    { name: "YAML to JSON", url: "/data" },
    { name: "Base64 Encoder", url: "/developer" },
    { name: "UUID Generator", url: "/developer" },
    { name: "QR Code Generator", url: "/developer" },
    { name: "JS Minifier", url: "/javascript" },
    { name: "CSS Gradient", url: "/javascript" },
    { name: "AI Summarizer", url: "/ai" },
  ];

  const filteredTools = searchQuery
    ? toolsList.filter((tool) =>
        tool.name.toLowerCase().includes(searchQuery.toLowerCase())
      )
    : [];

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (filteredTools.length > 0) {
      router.push(filteredTools[0].url);
      setSearchQuery("");
      setSearchOpen(false);
    }
    // If no tools match, keep the query visible so user can adjust it
  };

  return (
    <nav className="fixed top-0 left-0 right-0 z-50 glass-panel border-b border-slate-200/50 dark:border-slate-800/50 transition-all duration-300">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Logo */}
          <div className="flex items-center">
            <Link href="/" className="flex items-center space-x-2">
              <span className="p-1.5 rounded-lg bg-gradient-to-tr from-indigo-500 via-purple-500 to-pink-500 text-white font-bold flex items-center justify-center">
                <Command className="w-5 h-5" />
              </span>
              <span className="text-xl font-bold bg-clip-text text-gradient bg-gradient-to-r from-slate-900 to-slate-700 dark:from-white dark:to-slate-300">
                Easytoconvert
              </span>
            </Link>
          </div>

          {/* Desktop Nav Links */}
          <div className="hidden md:flex items-center space-x-4">
            <Link href="/pdf" className="text-slate-600 dark:text-slate-300 hover:text-primary dark:hover:text-primary transition-all text-sm font-medium flex items-center space-x-1">
              <FileText className="w-4 h-4" />
              <span>PDF</span>
            </Link>
            <Link href="/image" className="text-slate-600 dark:text-slate-300 hover:text-primary dark:hover:text-primary transition-all text-sm font-medium flex items-center space-x-1">
              <ImageIcon className="w-4 h-4" />
              <span>Image</span>
            </Link>
            <Link href="/data" className="text-slate-600 dark:text-slate-300 hover:text-primary dark:hover:text-primary transition-all text-sm font-medium flex items-center space-x-1">
              <Database className="w-4 h-4" />
              <span>Data</span>
            </Link>
            <Link href="/developer" className="text-slate-600 dark:text-slate-300 hover:text-primary dark:hover:text-primary transition-all text-sm font-medium flex items-center space-x-1">
              <Code className="w-4 h-4" />
              <span>Developer</span>
            </Link>
            <Link href="/ai" className="text-slate-600 dark:text-slate-300 hover:text-primary dark:hover:text-primary transition-all text-sm font-medium flex items-center space-x-1">
              <Sparkles className="w-4 h-4 text-purple-400" />
              <span>AI</span>
            </Link>

          </div>

          {/* Actions & Utilities */}
          <div className="hidden md:flex items-center space-x-4">
            {/* Search Bar */}
            <div className="relative">
              <form onSubmit={handleSearchSubmit} className="relative">
                <input
                  type="text"
                  placeholder="Quick find tool..."
                  className="w-48 xl:w-60 text-xs py-1.5 pl-8 pr-3 rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-100/50 dark:bg-slate-900/50 outline-none focus:border-indigo-500 transition-all focus:w-64"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
                <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-2.5" />
              </form>
              {/* Dropdown list of filtered tools */}
              {searchQuery && (
                <div className="absolute right-0 mt-2 w-64 rounded-xl border border-slate-200 dark:border-slate-800 bg-white/95 dark:bg-slate-950/95 backdrop-blur-lg shadow-xl overflow-hidden z-50">
                  {filteredTools.length > 0 ? (
                    filteredTools.map((tool) => (
                      <Link
                        key={tool.name}
                        href={tool.url}
                        onClick={() => setSearchQuery("")}
                        className="block px-4 py-2 text-sm text-slate-700 dark:text-slate-200 hover:bg-indigo-50 dark:hover:bg-slate-900"
                      >
                        {tool.name}
                      </Link>
                    ))
                  ) : (
                    <div className="px-4 py-3 text-xs text-slate-500">No tools match your query</div>
                  )}
                </div>
              )}
            </div>

            <ThemeToggle />

            <Link href="/dashboard" className="p-1.5 rounded-lg border border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-900 transition-all" title="Dashboard">
              <LayoutDashboard className="w-5 h-5" />
            </Link>

            <Link
              href="/dashboard"
              className="px-4 py-1.5 rounded-lg text-sm font-semibold bg-gradient-to-r from-indigo-600 to-purple-600 text-white shadow-lg shadow-indigo-500/20 hover:opacity-90 transition-all"
            >
              Dashboard
            </Link>
          </div>

          {/* Mobile menu toggle */}
          <div className="flex items-center space-x-2 md:hidden">
            <ThemeToggle />
            <button
              onClick={() => setIsOpen(!isOpen)}
              className="p-1.5 rounded-lg border border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-300 focus:outline-none"
            >
              {isOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </button>
          </div>
        </div>
      </div>

      {/* Mobile Drawer */}
      {isOpen && (
        <div className="md:hidden glass-panel border-t border-slate-200/50 dark:border-slate-800/50 transition-all duration-300">
          <div className="px-2 pt-2 pb-4 space-y-1 sm:px-3">
            <Link
              href="/pdf"
              onClick={() => setIsOpen(false)}
              className="block px-3 py-2 rounded-md text-base font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-900"
            >
              PDF Tools
            </Link>
            <Link
              href="/image"
              onClick={() => setIsOpen(false)}
              className="block px-3 py-2 rounded-md text-base font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-900"
            >
              Image Tools
            </Link>
            <Link
              href="/data"
              onClick={() => setIsOpen(false)}
              className="block px-3 py-2 rounded-md text-base font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-900"
            >
              Data Tools
            </Link>
            <Link
              href="/developer"
              onClick={() => setIsOpen(false)}
              className="block px-3 py-2 rounded-md text-base font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-900"
            >
              Developer Tools
            </Link>
            <Link
              href="/ai"
              onClick={() => setIsOpen(false)}
              className="block px-3 py-2 rounded-md text-base font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-900 text-purple-400"
            >
              AI Tools
            </Link>

            <Link
              href="/dashboard"
              onClick={() => setIsOpen(false)}
              className="block px-3 py-2 rounded-md text-base font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-900"
            >
              Dashboard
            </Link>
          </div>
        </div>
      )}
    </nav>
  );
}
