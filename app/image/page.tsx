import type { Metadata } from "next";
import { ImagePageClient } from "./PageClient";

export const metadata: Metadata = {
  title: "Free Image Converter & Compressor – Resize, Convert, Compress Online | EasyToConvert",
  description:
    "Compress, resize, and convert images between JPG, PNG, WebP, GIF formats for free in your browser. No uploads needed.",
  keywords: [
    "image compressor",
    "resize image",
    "convert image",
    "JPG to PNG",
    "WebP converter",
    "free image tools",
  ],
  alternates: { canonical: "https://www.easytoconvert.in/image" },
  openGraph: {
    title: "Free Image Converter & Compressor – Resize, Convert, Compress Online | EasyToConvert",
    description:
      "Compress, resize, and convert images between JPG, PNG, WebP, GIF formats for free in your browser. No uploads needed.",
    url: "https://www.easytoconvert.in/image",
    images: [{ url: "/og-image.png", width: 1200, height: 630, alt: "EasyToConvert" }],
  },
};

export default function ImagePage() {
  return <ImagePageClient />;
}
