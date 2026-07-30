"use client";

import React, { useState } from "react";
import { Mail, Github, Bug, Send } from "lucide-react";

const SUPPORT_EMAIL = "support@easytoconvert.in";
const REPO_URL = "https://github.com/Jians1987/EasyToconvert";

export function ContactPageClient() {
  const [formData, setFormData] = useState({ name: "", email: "", message: "" });

  // No mailbox server behind this form — it hands the message to the visitor's
  // own mail client so nothing is silently dropped.
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const subject = encodeURIComponent(`EasyToConvert feedback from ${formData.name || "a visitor"}`);
    const body = encodeURIComponent(`${formData.message}\n\n— ${formData.name}\nReply to: ${formData.email}`);
    window.location.href = `mailto:${SUPPORT_EMAIL}?subject=${subject}&body=${body}`;
  };

  return (
    <div className="space-y-12 max-w-4xl mx-auto">
      {/* Header */}
      <div className="text-center space-y-4">
        <h1 className="text-3xl md:text-5xl font-extrabold tracking-tight">Contact</h1>
        <p className="text-sm md:text-base text-slate-500 dark:text-slate-400 max-w-xl mx-auto">
          Found a bug, or got a file a converter choked on? Email us, or open an issue on GitHub — bug reports
          with a sample file are the fastest way to get something fixed.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Sidebar Info */}
        <div className="space-y-4">
          <a
            href={`mailto:${SUPPORT_EMAIL}`}
            className="glass-card p-5 flex items-center space-x-3 hover:border-indigo-500/40 transition-all"
          >
            <Mail className="w-5 h-5 text-indigo-500 shrink-0" />
            <div className="min-w-0">
              <h4 className="text-xs font-bold text-slate-800 dark:text-slate-200">Email</h4>
              <span className="text-[10px] text-slate-400 break-all">{SUPPORT_EMAIL}</span>
            </div>
          </a>

          <a
            href={`${REPO_URL}/issues`}
            target="_blank"
            rel="noopener noreferrer"
            className="glass-card p-5 flex items-center space-x-3 hover:border-indigo-500/40 transition-all"
          >
            <Bug className="w-5 h-5 text-emerald-500 shrink-0" />
            <div className="min-w-0">
              <h4 className="text-xs font-bold text-slate-800 dark:text-slate-200">Report a Bug</h4>
              <span className="text-[10px] text-slate-400">Open a GitHub issue</span>
            </div>
          </a>

          <a
            href={REPO_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="glass-card p-5 flex items-center space-x-3 hover:border-indigo-500/40 transition-all"
          >
            <Github className="w-5 h-5 text-amber-500 shrink-0" />
            <div className="min-w-0">
              <h4 className="text-xs font-bold text-slate-800 dark:text-slate-200">Source Code</h4>
              <span className="text-[10px] text-slate-400">Browse the repository</span>
            </div>
          </a>
        </div>

        {/* Message Form */}
        <div className="md:col-span-2 glass-card p-6">
          <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-[10px] uppercase font-bold text-slate-400">Your Name</label>
                  <input
                    type="text"
                    required
                    placeholder="Jane Doe"
                    className="w-full glass-input text-xs"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] uppercase font-bold text-slate-400">Email Address</label>
                  <input
                    type="email"
                    required
                    placeholder="jane@company.com"
                    className="w-full glass-input text-xs"
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  />
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-[10px] uppercase font-bold text-slate-400">Your Message</label>
                <textarea
                  rows={4}
                  required
                  placeholder="How can we help?"
                  className="w-full glass-input text-xs resize-none"
                  value={formData.message}
                  onChange={(e) => setFormData({ ...formData, message: e.target.value })}
                />
              </div>

              <button
                type="submit"
                className="w-full py-2.5 rounded-lg text-xs font-semibold bg-gradient-to-r from-indigo-600 to-purple-600 text-white shadow-lg shadow-indigo-500/20 hover:opacity-90 transition-all flex items-center justify-center space-x-1.5"
              >
                <Send className="w-3.5 h-3.5" />
                <span>Compose Email</span>
              </button>

              <p className="text-[10px] text-slate-400 text-center leading-relaxed">
                This opens your own email app with the message ready to send — nothing is submitted to a server
                from this page. Prefer to write it yourself?{" "}
                <a href={`mailto:${SUPPORT_EMAIL}`} className="text-indigo-500 hover:underline font-semibold">
                  {SUPPORT_EMAIL}
                </a>
              </p>
            </form>
        </div>
      </div>
    </div>
  );
}
