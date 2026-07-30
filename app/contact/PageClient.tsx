"use client";

import React, { useState } from "react";
import { Mail, Github, Bug, Send, CheckCircle, AlertTriangle, Loader2 } from "lucide-react";

const SUPPORT_EMAIL = "support@easytoconvert.in";
const REPO_URL = "https://github.com/Jians1987/EasyToconvert";

type SendState = "idle" | "sending" | "sent";

export function ContactPageClient() {
  const [formData, setFormData] = useState({ name: "", email: "", message: "", website: "" });
  const [state, setState] = useState<SendState>("idle");
  const [error, setError] = useState("");

  // Posts to /api/contact, which relays over SMTP. Success is only ever shown
  // after the server confirms the send — a failure must say so, not pretend.
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setState("sending");
    setError("");

    try {
      const res = await fetch("/api/contact", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData),
      });

      const payload = await res.json().catch(() => ({}));

      if (!res.ok) {
        setError(payload?.error || "We couldn't send your message. Please email us directly instead.");
        setState("idle");
        return;
      }

      setFormData({ name: "", email: "", message: "", website: "" });
      setState("sent");
    } catch {
      setError("Network error — check your connection, or email us directly.");
      setState("idle");
    }
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
          {state === "sent" ? (
            <div className="h-full flex flex-col items-center justify-center text-center space-y-4 py-8">
              <CheckCircle className="w-12 h-12 text-emerald-500" />
              <div className="space-y-1">
                <h3 className="font-bold text-slate-800 dark:text-slate-100">Message sent</h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 max-w-xs mx-auto leading-relaxed">
                  It landed in our inbox and we&rsquo;ll reply to the address you gave.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setState("idle")}
                className="text-xs font-semibold text-indigo-500 hover:underline"
              >
                Send another message
              </button>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              {/* Honeypot — hidden from people, catches bots that fill every field */}
              <input
                type="text"
                name="website"
                tabIndex={-1}
                autoComplete="off"
                aria-hidden="true"
                className="hidden"
                value={formData.website}
                onChange={(e) => setFormData({ ...formData, website: e.target.value })}
              />

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

              {error && (
                <div className="p-3 rounded-lg border border-red-500/30 bg-red-50/60 dark:bg-red-950/20 flex items-start space-x-2">
                  <AlertTriangle className="w-4 h-4 text-red-500 mt-0.5 shrink-0" />
                  <p className="text-[11px] text-red-700 dark:text-red-400 leading-relaxed">{error}</p>
                </div>
              )}

              <button
                type="submit"
                disabled={state === "sending"}
                className="w-full py-2.5 rounded-lg text-xs font-semibold bg-gradient-to-r from-indigo-600 to-purple-600 text-white shadow-lg shadow-indigo-500/20 hover:opacity-90 transition-all flex items-center justify-center space-x-1.5 disabled:opacity-60 disabled:cursor-not-allowed"
              >
                {state === "sending" ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    <span>Sending…</span>
                  </>
                ) : (
                  <>
                    <Send className="w-3.5 h-3.5" />
                    <span>Send Message</span>
                  </>
                )}
              </button>

              <p className="text-[10px] text-slate-400 text-center leading-relaxed">
                Goes straight to our inbox. Prefer your own mail app?{" "}
                <a href={`mailto:${SUPPORT_EMAIL}`} className="text-indigo-500 hover:underline font-semibold">
                  {SUPPORT_EMAIL}
                </a>
              </p>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
