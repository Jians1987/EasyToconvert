import type { Metadata } from "next";
import { MediaPageClient } from "./PageClient";

export const metadata: Metadata = {
  title: "Free Online Video & Audio Converter – Compress MP4, MP3 | EasyToConvert",
  description:
    "Compress and convert video and audio files online for free using FFmpeg WebAssembly. No uploads — everything runs in your browser.",
  keywords: [
    "video compressor",
    "audio converter",
    "compress MP4",
    "compress MP3",
    "FFmpeg online",
    "media tools",
  ],
  alternates: { canonical: "https://www.easytoconvert.in/media" },
  openGraph: {
    title: "Free Online Video & Audio Converter – Compress MP4, MP3 | EasyToConvert",
    description:
      "Compress and convert video and audio files online for free using FFmpeg WebAssembly. No uploads — everything runs in your browser.",
    url: "https://www.easytoconvert.in/media",
    images: [{ url: "/og-image.png", width: 1200, height: 630, alt: "EasyToConvert" }],
  },
};

export default function MediaPage() {
  return <MediaPageClient />;
}
