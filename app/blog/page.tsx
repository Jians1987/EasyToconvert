"use client";

import React from "react";
import Link from "next/link";
import { BookOpen, Calendar, Clock, ChevronRight } from "lucide-react";

export default function Blog() {
  const posts = [
    {
      title: "Optimizing Web Images for Next-generation Core Web Vitals",
      excerpt: "Learn how converting JPG assets to WebP and SVG reduces layout shifts and boosts SEO rankings.",
      date: "June 12, 2026",
      readTime: "5 min read",
      category: "Image Studio",
    },
    {
      title: "Why Client-side PDF Compositions are Safer for Enterprises",
      excerpt: "Analyzing the security implications of uploading sensitive agreements vs merging them directly inside browser engines.",
      date: "May 28, 2026",
      readTime: "8 min read",
      category: "PDF Suite",
    },
    {
      title: "Data Serialization Formats: JSON, XML, YAML, and CSV",
      excerpt: "Deep dive into schema definitions, conversion rules, structural differences, and usage performance markers.",
      date: "May 15, 2026",
      readTime: "6 min read",
      category: "Developer Hub",
    },
  ];

  return (
    <div className="space-y-12 max-w-4xl mx-auto">
      {/* Header */}
      <div className="text-center space-y-4">
        <h1 className="text-3xl md:text-5xl font-extrabold tracking-tight">Articles & Guides</h1>
        <p className="text-sm md:text-base text-slate-500 dark:text-slate-400 max-w-xl mx-auto">
          Read tutorials on optimizing performance, handling data pipelines, and security best practices.
        </p>
      </div>

      {/* Grid of posts */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {posts.map((post) => (
          <div key={post.title} className="glass-card p-6 flex flex-col justify-between">
            <div className="space-y-4">
              <span className="text-[9px] uppercase font-bold tracking-wider px-2 py-0.5 rounded border border-indigo-500/30 text-indigo-500 w-fit block">
                {post.category}
              </span>
              <h3 className="text-sm font-bold text-slate-800 dark:text-slate-100 leading-snug">
                {post.title}
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
                {post.excerpt}
              </p>
            </div>

            <div className="pt-6 mt-6 border-t border-slate-100 dark:border-slate-850 flex flex-col space-y-3">
              <div className="flex items-center justify-between text-[10px] text-slate-400">
                <span className="flex items-center space-x-1">
                  <Calendar className="w-3.5 h-3.5" />
                  <span>{post.date}</span>
                </span>
                <span className="flex items-center space-x-1">
                  <Clock className="w-3.5 h-3.5" />
                  <span>{post.readTime}</span>
                </span>
              </div>
              <button className="text-xs font-bold text-indigo-500 flex items-center space-x-1 hover:underline">
                <span>Read Article</span>
                <ChevronRight className="w-3 h-3" />
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
