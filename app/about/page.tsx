import type { Metadata } from "next";
import { AboutPageClient } from "./PageClient";

export const metadata: Metadata = {
  title: "About EasyToConvert – Privacy-First Free Online Tools",
  description:
    "Learn about EasyToConvert — a free, privacy-first platform built to give everyone powerful online tools with local-first processing and clearly marked, opt-in cloud features.",
  alternates: { canonical: "https://www.easytoconvert.in/about" },
  openGraph: {
    title: "About EasyToConvert – Privacy-First Free Online Tools",
    description:
      "Learn about EasyToConvert — a free, privacy-first platform built to give everyone powerful online tools with local-first processing and clearly marked, opt-in cloud features.",
    url: "https://www.easytoconvert.in/about",
    images: [{ url: "/og-image.png", width: 1200, height: 630, alt: "EasyToConvert" }],
  },
};

export default function AboutPage() {
  return <AboutPageClient />;
}
