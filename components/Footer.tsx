"use client";

import React from "react";
import Link from "next/link";
import { Command, Heart, Globe, Shield, RefreshCw } from "lucide-react";

export default function Footer() {
  return (
    <footer className="mt-auto border-t border-slate-200/50 dark:border-slate-800/50 bg-slate-100/30 dark:bg-slate-950/30 backdrop-blur-md">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="grid grid-cols-1 md:grid-cols-5 gap-8">
          {/* Brand Info */}
          <div className="md:col-span-2 space-y-4">
            <Link href="/" className="flex items-center space-x-2">
              <span className="p-1.5 rounded-lg bg-gradient-to-tr from-indigo-500 via-purple-500 to-pink-500 text-white font-bold flex items-center justify-center">
                <Command className="w-4 h-4" />
              </span>
              <span className="text-lg font-bold bg-clip-text text-gradient bg-gradient-to-r from-slate-900 to-slate-700 dark:from-white dark:to-slate-300">
                Easytoconvert
              </span>
            </Link>
            <p className="text-xs text-slate-500 dark:text-slate-400 max-w-sm leading-relaxed">
              Easytoconvert provides fast, secure, browser-based conversion, code styling, data transformations, and media optimization tools. All file conversions are processed locally or secure serverless modules for highest privacy.
            </p>
            <div className="flex space-x-4 pt-2">
              <div className="flex items-center space-x-1.5 text-xs text-slate-400">
                <Globe className="w-3.5 h-3.5 text-indigo-400" />
                <span>Multi-language</span>
              </div>
              <div className="flex items-center space-x-1.5 text-xs text-slate-400">
                <Shield className="w-3.5 h-3.5 text-emerald-400" />
                <span>Privacy First</span>
              </div>
              <div className="flex items-center space-x-1.5 text-xs text-slate-400">
                <RefreshCw className="w-3.5 h-3.5 text-cyan-400 animate-spin-slow" />
                <span>Fast Core Engine</span>
              </div>
            </div>
          </div>

          {/* Column 1: PDF & Image */}
          <div>
            <h4 className="text-sm font-semibold text-slate-900 dark:text-slate-200 mb-4">Core Converters</h4>
            <ul className="space-y-2 text-xs">
              <li>
                <Link href="/pdf" className="text-slate-500 dark:text-slate-400 hover:text-primary dark:hover:text-primary transition-all">
                  Merge & Split PDF
                </Link>
              </li>
              <li>
                <Link href="/pdf" className="text-slate-500 dark:text-slate-400 hover:text-primary dark:hover:text-primary transition-all">
                  Rotate PDF
                </Link>
              </li>
              <li>
                <Link href="/image" className="text-slate-500 dark:text-slate-400 hover:text-primary dark:hover:text-primary transition-all">
                  PNG to JPG & WebP
                </Link>
              </li>
              <li>
                <Link href="/image" className="text-slate-500 dark:text-slate-400 hover:text-primary dark:hover:text-primary transition-all">
                  Image Compressor
                </Link>
              </li>
              <li>
                <Link href="/image" className="text-slate-500 dark:text-slate-400 hover:text-primary dark:hover:text-primary transition-all">
                  Image Metadata Viewer
                </Link>
              </li>
            </ul>
          </div>

          {/* Column 2: Data & Code */}
          <div>
            <h4 className="text-sm font-semibold text-slate-900 dark:text-slate-200 mb-4">Developer Tools</h4>
            <ul className="space-y-2 text-xs">
              <li>
                <Link href="/data" className="text-slate-500 dark:text-slate-400 hover:text-primary dark:hover:text-primary transition-all">
                  JSON Formatter
                </Link>
              </li>
              <li>
                <Link href="/data" className="text-slate-500 dark:text-slate-400 hover:text-primary dark:hover:text-primary transition-all">
                  CSV to JSON / XML
                </Link>
              </li>
              <li>
                <Link href="/developer" className="text-slate-500 dark:text-slate-400 hover:text-primary dark:hover:text-primary transition-all">
                  Base64 Encode & Decode
                </Link>
              </li>
              <li>
                <Link href="/developer" className="text-slate-500 dark:text-slate-400 hover:text-primary dark:hover:text-primary transition-all">
                  QR Code Generator
                </Link>
              </li>
              <li>
                <Link href="/javascript" className="text-slate-500 dark:text-slate-400 hover:text-primary dark:hover:text-primary transition-all">
                  JS & CSS Minifier
                </Link>
              </li>
            </ul>
          </div>

          {/* Column 3: Platform */}
          <div>
            <h4 className="text-sm font-semibold text-slate-900 dark:text-slate-200 mb-4">Platform</h4>
            <ul className="space-y-2 text-xs">
              <li>
                <Link href="https://github.com/Jians1987/EasyToconvert" className="text-slate-500 dark:text-slate-400 hover:text-primary dark:hover:text-primary transition-all">
                  GitHub Source
                </Link>
              </li>
              <li>
                <Link href="/api-docs" className="text-slate-500 dark:text-slate-400 hover:text-primary dark:hover:text-primary transition-all">
                  API Documentation
                </Link>
              </li>
              <li>
                <Link href="/about" className="text-slate-500 dark:text-slate-400 hover:text-primary dark:hover:text-primary transition-all">
                  About Us
                </Link>
              </li>
              <li>
                <Link href="/contact" className="text-slate-500 dark:text-slate-400 hover:text-primary dark:hover:text-primary transition-all">
                  Contact
                </Link>
              </li>
              <li>
                <Link href="/blog" className="text-slate-500 dark:text-slate-400 hover:text-primary dark:hover:text-primary transition-all">
                  Blog
                </Link>
              </li>
            </ul>
          </div>
        </div>

        <div className="mt-8 pt-8 border-t border-slate-200/50 dark:border-slate-800/50 flex flex-col md:flex-row justify-between items-center space-y-4 md:space-y-0">
          <p className="text-xs text-slate-500 dark:text-slate-400">
            &copy; {new Date().getFullYear()} Easytoconvert. All rights reserved. PWA Ready.
          </p>
          <p className="text-xs text-slate-500 dark:text-slate-400 flex items-center">
            Made with <Heart className="w-3 h-3 mx-1 text-red-500 fill-red-500" /> for developers & content creators.
          </p>
        </div>
      </div>
    </footer>
  );
}
