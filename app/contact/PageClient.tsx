"use client";

import React, { useState } from "react";
import { Mail, MessageSquare, MapPin, Send, CheckCircle } from "lucide-react";

export function ContactPageClient() {
  const [submitted, setSubmitted] = useState(false);
  const [formData, setFormData] = useState({ name: "", email: "", message: "" });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (formData.name && formData.email && formData.message) {
      setSubmitted(true);
      setFormData({ name: "", email: "", message: "" });
      setTimeout(() => setSubmitted(false), 5000);
    }
  };

  return (
    <div className="space-y-12 max-w-4xl mx-auto">
      {/* Header */}
      <div className="text-center space-y-4">
        <h1 className="text-3xl md:text-5xl font-extrabold tracking-tight">Contact Us</h1>
        <p className="text-sm md:text-base text-slate-500 dark:text-slate-400 max-w-xl mx-auto">
          Have feedback, bugs reports, or scaling questions? Send us a message and our engineers will reply shortly.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Sidebar Info */}
        <div className="space-y-4">
          <div className="glass-card p-5 flex items-center space-x-3">
            <Mail className="w-5 h-5 text-indigo-500" />
            <div>
              <h4 className="text-xs font-bold text-slate-800 dark:text-slate-200">Email Address</h4>
              <span className="text-[10px] text-slate-400">support@easytoconvert.com</span>
            </div>
          </div>

          <div className="glass-card p-5 flex items-center space-x-3">
            <MessageSquare className="w-5 h-5 text-emerald-500" />
            <div>
              <h4 className="text-xs font-bold text-slate-800 dark:text-slate-200">Support Chat</h4>
              <span className="text-[10px] text-slate-400">Available 24/7 inside Pro dashboard</span>
            </div>
          </div>

          <div className="glass-card p-5 flex items-center space-x-3">
            <MapPin className="w-5 h-5 text-amber-500" />
            <div>
              <h4 className="text-xs font-bold text-slate-800 dark:text-slate-200">Headquarters</h4>
              <span className="text-[10px] text-slate-400">San Francisco, CA</span>
            </div>
          </div>
        </div>

        {/* Message Form */}
        <div className="md:col-span-2 glass-card p-6">
          {submitted ? (
            <div className="h-full flex flex-col items-center justify-center text-center space-y-4 py-8">
              <CheckCircle className="w-12 h-12 text-emerald-500 animate-bounce" />
              <div>
                <h3 className="font-bold text-slate-800 dark:text-slate-100">Message Received!</h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 max-w-xs">
                  Thank you for reaching out. We will read your feedback and contact you shortly.
                </p>
              </div>
            </div>
          ) : (
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
                <span>Submit Message</span>
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
