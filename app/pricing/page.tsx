"use client";

import React, { useState } from "react";
import { Check, ShieldCheck, Zap, Server, ChevronRight } from "lucide-react";

export default function Pricing() {
  const [billingCycle, setBillingCycle] = useState<"monthly" | "yearly">("monthly");

  const plans = [
    {
      name: "Free Developer",
      price: 0,
      description: "Ideal for individual developer formatting and basic converters.",
      features: [
        "Up to 50MB file size uploads",
        "Client-side processing (PDF/Image)",
        "JSON/XML validator utility suite",
        "Local Download history (100 logs)",
        "Light & Dark UI customization",
      ],
      cta: "Current Plan",
      popular: false,
    },
    {
      name: "Pro Creator",
      price: billingCycle === "monthly" ? 9 : 79,
      description: "Perfect for heavy image optimization, contract summaries, and batch actions.",
      features: [
        "Up to 2GB file size uploads",
        "AI Summarizer & code assistants",
        "Parallel bulk files conversions",
        "Cloud storage integration (S3/GDrive)",
        "Stripe / Razorpay express checkout",
        "Dedicated API token access keys",
      ],
      cta: "Upgrade to Pro",
      popular: true,
    },
    {
      name: "Enterprise",
      price: "Custom",
      description: "For production scaling, server integrations, and team workspaces.",
      features: [
        "Unlimited file sizes processing",
        "Custom webhooks integrations",
        "99.9% uptime service level SLA",
        "Custom AI model fine-tuning config",
        "Dedicated account engineers",
        "SAML SSO access profiles",
      ],
      cta: "Contact Enterprise",
      popular: false,
    },
  ];

  return (
    <div className="space-y-12">
      {/* Header */}
      <div className="text-center max-w-2xl mx-auto space-y-4">
        <h1 className="text-3xl md:text-5xl font-extrabold tracking-tight">Flexible, Transparent Pricing</h1>
        <p className="text-sm md:text-base text-slate-500 dark:text-slate-400">
          Get access to AI tools, developer keys, and batch operations. Save up to 25% with yearly plans.
        </p>

        {/* Toggle Switch */}
        <div className="inline-flex items-center p-1 rounded-full bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
          <button
            onClick={() => setBillingCycle("monthly")}
            className={`px-4 py-1.5 rounded-full text-xs font-semibold transition-all ${
              billingCycle === "monthly"
                ? "bg-indigo-650 text-white shadow-md bg-indigo-600"
                : "text-slate-500 hover:text-slate-800 dark:hover:text-slate-200"
            }`}
          >
            Monthly billing
          </button>
          <button
            onClick={() => setBillingCycle("yearly")}
            className={`px-4 py-1.5 rounded-full text-xs font-semibold transition-all ${
              billingCycle === "yearly"
                ? "bg-indigo-650 text-white shadow-md bg-indigo-600"
                : "text-slate-500 hover:text-slate-800 dark:hover:text-slate-200"
            }`}
          >
            Yearly billing
          </button>
        </div>
      </div>

      {/* Grid of Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 max-w-6xl mx-auto items-stretch">
        {plans.map((plan) => (
          <div
            key={plan.name}
            className={`glass-card p-6 flex flex-col justify-between relative ${
              plan.popular
                ? "border-indigo-500/80 dark:border-indigo-500/80 shadow-2xl scale-[1.02] bg-white/90 dark:bg-slate-900/80"
                : "border-slate-200/60 dark:border-slate-800/80"
            }`}
          >
            {plan.popular && (
              <span className="absolute top-0 right-6 -translate-y-1/2 px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider bg-indigo-650 bg-indigo-600 text-white">
                Best Value
              </span>
            )}

            <div className="space-y-6">
              {/* Header */}
              <div>
                <h3 className="text-lg font-bold text-slate-800 dark:text-slate-100">{plan.name}</h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 leading-normal">
                  {plan.description}
                </p>
              </div>

              {/* Price */}
              <div className="flex items-baseline">
                <span className="text-3xl md:text-4xl font-extrabold text-slate-800 dark:text-slate-100">
                  {typeof plan.price === "number" ? `$${plan.price}` : plan.price}
                </span>
                {typeof plan.price === "number" && (
                  <span className="text-slate-500 text-xs ml-1.5 font-medium">
                    /{billingCycle === "monthly" ? "mo" : "yr"}
                  </span>
                )}
              </div>

              {/* Divider */}
              <div className="h-[1px] bg-slate-100 dark:bg-slate-850 bg-slate-200/50 dark:bg-slate-800/50" />

              {/* Features List */}
              <ul className="space-y-2.5 text-xs text-slate-655 text-slate-600 dark:text-slate-400">
                {plan.features.map((feature) => (
                  <li key={feature} className="flex items-start space-x-2.5">
                    <Check className="w-4 h-4 text-emerald-500 flex-shrink-0 mt-0.5" />
                    <span>{feature}</span>
                  </li>
                ))}
              </ul>
            </div>

            {/* Action button */}
            <div className="pt-8">
              <button
                className={`w-full py-2.5 rounded-xl text-xs font-semibold transition-all ${
                  plan.popular
                    ? "bg-gradient-to-r from-indigo-600 via-purple-600 to-pink-600 text-white shadow-lg shadow-indigo-500/20 hover:opacity-90"
                    : "bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-750 text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-700"
                }`}
              >
                {plan.cta}
              </button>
            </div>
          </div>
        ))}
      </div>

      {/* Trust & Checkout Badge */}
      <div className="max-w-xl mx-auto p-4 rounded-xl border border-slate-200/50 dark:border-slate-800/50 bg-slate-100/30 dark:bg-slate-900/10 flex flex-col sm:flex-row items-center justify-between gap-4 text-center sm:text-left">
        <div className="flex items-center space-x-3">
          <ShieldCheck className="w-8 h-8 text-emerald-500" />
          <div className="text-xs text-slate-500 dark:text-slate-400">
            <span className="font-semibold text-slate-850 dark:text-slate-350 block">Secured checkout</span>
            Powered by Stripe and Razorpay integrations. 30-day money-back guarantee.
          </div>
        </div>
        <div className="flex items-center space-x-3 text-slate-400 text-xs font-semibold">
          <span>Stripe</span>
          <span>•</span>
          <span>Razorpay</span>
        </div>
      </div>
    </div>
  );
}
