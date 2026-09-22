"use client";

import React, { useState } from "react";
import Link from "next/link";
import CommandPalette from "./CommandPalette";
import ThemeToggle from "./ThemeToggle";
import { Menu, X, Command, Sparkles, LayoutDashboard, Database, FileText, Image as ImageIcon, Code } from "lucide-react";

export default function Navbar() {
  const [isOpen, setIsOpen] = useState(false);

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
          <div className="hidden lg:flex items-center space-x-4">
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

          <CommandPalette />

          {/* Actions */}
          <div className="hidden lg:flex items-center space-x-4">
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

          {/* Mobile toggle */}
          <div className="flex items-center space-x-2 lg:hidden">
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
        <div className="lg:hidden glass-panel border-t border-slate-200/50 dark:border-slate-800/50 transition-all duration-300">
          <div className="px-2 pt-2 pb-4 space-y-1 sm:px-3">
            <Link href="/pdf" onClick={() => setIsOpen(false)} className="block px-3 py-2 rounded-md text-base font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-900">
              PDF Tools
            </Link>
            <Link href="/image" onClick={() => setIsOpen(false)} className="block px-3 py-2 rounded-md text-base font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-900">
              Image Tools
            </Link>
            <Link href="/data" onClick={() => setIsOpen(false)} className="block px-3 py-2 rounded-md text-base font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-900">
              Data Tools
            </Link>
            <Link href="/developer" onClick={() => setIsOpen(false)} className="block px-3 py-2 rounded-md text-base font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-900">
              Developer Tools
            </Link>
            <Link href="/ai" onClick={() => setIsOpen(false)} className="block px-3 py-2 rounded-md text-base font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-900 text-purple-400">
              AI Tools
            </Link>
            <Link href="/table-detect" onClick={() => setIsOpen(false)} className="block px-3 py-2 rounded-md text-base font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-900">
              Table Detection
            </Link>
            <Link href="/dashboard" onClick={() => setIsOpen(false)} className="block px-3 py-2 rounded-md text-base font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-900">
              Dashboard
            </Link>
          </div>
        </div>
      )}
    </nav>
  );
}
