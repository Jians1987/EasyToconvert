import type { Metadata } from "next";
import { JavascriptPageClient } from "./PageClient";

export const metadata: Metadata = {
  title: "Free JavaScript & CSS Tools – Minifier, Formatter, Box-Shadow | EasyToConvert",
  description:
    "Minify and format JavaScript and CSS code online. Generate CSS box-shadows, gradients, and more with live preview.",
  keywords: [
    "JavaScript minifier",
    "CSS minifier",
    "CSS formatter",
    "box-shadow generator",
    "JS formatter",
    "online code tools",
  ],
  alternates: { canonical: "https://www.easytoconvert.in/javascript" },
  openGraph: {
    title: "Free JavaScript & CSS Tools – Minifier, Formatter, Box-Shadow | EasyToConvert",
    description:
      "Minify and format JavaScript and CSS code online. Generate CSS box-shadows, gradients, and more with live preview.",
    url: "https://www.easytoconvert.in/javascript",
    images: [{ url: "/og-image.png", width: 1200, height: 630, alt: "EasyToConvert" }],
  },
};

export default function JavascriptPage() {
  return <JavascriptPageClient />;
}
