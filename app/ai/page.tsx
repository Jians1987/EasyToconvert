import type { Metadata } from "next";
import { AiPageClient } from "./PageClient";

export const metadata: Metadata = {
  title: "Free AI Tools – PDF Summarizer, Image OCR, Code Explainer | EasyToConvert",
  description:
    "Extract text from images with OCR, summarize PDFs, explain code, and translate text — all powered by on-device AI in your browser.",
  keywords: [
    "PDF summarizer",
    "image OCR",
    "code explainer",
    "text extractor",
    "AI tools online",
    "on-device AI",
  ],
  alternates: { canonical: "https://www.easytoconvert.in/ai" },
  openGraph: {
    title: "Free AI Tools – PDF Summarizer, Image OCR, Code Explainer | EasyToConvert",
    description:
      "Extract text from images with OCR, summarize PDFs, explain code, and translate text — all powered by on-device AI in your browser.",
    url: "https://www.easytoconvert.in/ai",
    images: [{ url: "/og-image.png", width: 1200, height: 630, alt: "EasyToConvert" }],
  },
};

export default function AiPage() {
  return <AiPageClient />;
}
