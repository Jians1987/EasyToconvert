"use client";

import React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { FileText, Image as ImageIcon, Database, Code, Sparkles, Video, HelpCircle, ArrowLeft } from "lucide-react";

interface ToolLayoutProps {
  title: string;
  description: string;
  category: "pdf" | "image" | "data" | "developer" | "javascript" | "ai" | "media";
  children: React.ReactNode;
}

export default function ToolLayout({
  title,
  description,
  category,
  children,
}: ToolLayoutProps) {
  const pathname = usePathname();

  const categories = [
    { id: "pdf", name: "PDF Tools", icon: FileText, path: "/pdf" },
    { id: "image", name: "Image Tools", icon: ImageIcon, path: "/image" },
    { id: "data", name: "Data Converters", icon: Database, path: "/data" },
    { id: "developer", name: "Developer Tools", icon: Code, path: "/developer" },
    { id: "javascript", name: "JS & HTML/CSS", icon: Code, path: "/javascript" },
    { id: "ai", name: "AI Assistants", icon: Sparkles, path: "/ai" },
    { id: "media", name: "Video & Audio", icon: Video, path: "/media" },
  ];

  return (
    <div className="space-y-6">
      {/* Back to Home & Breadcrumbs */}
      <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
        <Link href="/" className="flex items-center space-x-1 hover:text-primary transition-all">
          <ArrowLeft className="w-3.5 h-3.5" />
          <span>Back to Home</span>
        </Link>
        <div className="flex items-center space-x-1.5">
          <span>Home</span>
          <span>/</span>
          <span className="capitalize">{category}</span>
          <span>/</span>
          <span className="text-slate-800 dark:text-slate-200 truncate max-w-xs">{title}</span>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6 items-start">
        {/* Sidebar Nav */}
        <aside className="lg:col-span-1 space-y-4 lg:sticky lg:top-20">
          <div className="p-4 rounded-xl border border-slate-200/60 dark:border-slate-800/80 bg-white/60 dark:bg-slate-900/40 backdrop-blur-md">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-400 mb-3 px-2">
              Categories
            </h3>
            <nav className="space-y-1">
              {categories.map((cat) => {
                const Icon = cat.icon;
                const isActive = pathname.startsWith(cat.path);
                return (
                  <Link
                    key={cat.id}
                    href={cat.path}
                    className={`flex items-center space-x-2.5 px-3 py-2 rounded-lg text-sm font-medium transition-all ${
                      isActive
                        ? "bg-indigo-600 text-white shadow-md shadow-indigo-500/20"
                        : "text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-900 hover:text-slate-900 dark:hover:text-slate-200"
                    }`}
                  >
                    <Icon className="w-4 h-4" />
                    <span>{cat.name}</span>
                  </Link>
                );
              })}
            </nav>
          </div>

          <div className="p-4 rounded-xl border border-slate-200/50 dark:border-slate-800/50 bg-slate-100/30 dark:bg-slate-900/10 text-xs text-slate-500 dark:text-slate-400 flex items-start space-x-2">
            <HelpCircle className="w-4 h-4 text-indigo-400 flex-shrink-0 mt-0.5" />
            <div className="space-y-1">
              <span className="font-semibold text-slate-700 dark:text-slate-300">Need help?</span>
              <p className="leading-normal">
                All files are processed securely in your browser. No data is sent to external servers. All tools are completely free with no limits.
              </p>
            </div>
          </div>
        </aside>

        {/* Main Content Area */}
        <div className="lg:col-span-3 space-y-6">
          <div className="space-y-2">
            <h1 className="text-2xl md:text-3xl font-extrabold tracking-tight bg-clip-text text-transparent bg-gradient-to-r from-slate-900 via-slate-800 to-indigo-600 dark:from-white dark:via-slate-200 dark:to-indigo-400">
              {title}
            </h1>
            <p className="text-sm text-slate-500 dark:text-slate-400 max-w-2xl leading-relaxed">
              {description}
            </p>
          </div>

          {/* Actual Tool Card */}
          <div className="p-6 rounded-xl border border-slate-200/60 dark:border-slate-800/80 bg-white/70 dark:bg-slate-900/60 backdrop-blur-lg shadow-xl relative overflow-hidden">
            <div className="absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500" />
            {children}
          </div>
        </div>
      </div>
    </div>
  );
}
