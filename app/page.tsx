import type { Metadata } from "next";
import { HomeClient } from "./HomeClient";

const siteUrl = "https://www.easytoconvert.in";

export const metadata: Metadata = {
  title: "EasyToConvert – Free Online PDF, Image & Developer Tools",
  description:
    "Free online tools to merge, split, edit & convert PDFs, compress & resize images, beautify JSON/CSV, generate QR codes, run OCR, and compress media — all in your browser. No uploads, 100% private.",
  alternates: {
    canonical: siteUrl,
  },
  openGraph: {
    title: "EasyToConvert – Free Online PDF, Image & Developer Tools",
    description:
      "100+ free browser-based tools. Merge PDFs, convert images, beautify JSON, generate QR codes and much more. No file uploads — everything runs locally in your browser.",
    url: siteUrl,
    images: [{ url: "/og-image.png", width: 1200, height: 630, alt: "EasyToConvert Tools" }],
  },
};

export default function Home() {
  return <HomeClient />;
}
