import type { Metadata } from "next";
import { BlogPageClient } from "./PageClient";

export const metadata: Metadata = {
  title: "Blog – Tips, Guides & News | EasyToConvert",
  description:
    "Read articles, tips, and guides about PDF tools, image conversion, developer utilities, and productivity on EasyToConvert.",
  alternates: { canonical: "https://www.easytoconvert.in/blog" },
  openGraph: {
    title: "Blog – Tips, Guides & News | EasyToConvert",
    description:
      "Read articles, tips, and guides about PDF tools, image conversion, developer utilities, and productivity on EasyToConvert.",
    url: "https://www.easytoconvert.in/blog",
    images: [{ url: "/og-image.png", width: 1200, height: 630, alt: "EasyToConvert" }],
  },
};

export default function BlogPage() {
  return <BlogPageClient />;
}
