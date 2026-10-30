import type { Metadata } from "next";
import { MediaPageClient } from "./PageClient";

export const metadata: Metadata = {
  title: "Free Audio Tools – Compress Audio, Video to MP3, Trim MP3",
  description:
    "Compress audio, extract MP3 audio from videos, and trim audio clips for free with FFmpeg WebAssembly. No uploads — everything runs in your browser.",
  keywords: [
    "video to MP3",
    "audio converter",
    "trim audio",
    "compress MP3",
    "FFmpeg online",
    "media tools",
  ],
  alternates: { canonical: "https://www.easytoconvert.in/media" },
  openGraph: {
    title: "Free Audio Tools – Compress Audio, Video to MP3, Trim MP3",
    description:
      "Compress audio, extract MP3 audio from videos, and trim audio clips for free with FFmpeg WebAssembly. No uploads — everything runs in your browser.",
    url: "https://www.easytoconvert.in/media",
    images: [{ url: "/og-image.png", width: 1200, height: 630, alt: "EasyToConvert" }],
  },
};

export default function MediaPage() {
  return <MediaPageClient />;
}
