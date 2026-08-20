import type { Metadata } from "next";

// page.tsx is a client component and cannot export metadata itself, so the
// route's SEO lives here.
export const metadata: Metadata = {
  title: "Free Word to Markdown Converter – DOCX to .md Online",
  description:
    "Convert Word .docx files to clean Markdown in your browser. Headings, lists, tables, bold, links, and images are preserved. Free, private, no sign-up — your file never leaves your device.",
  keywords: [
    "word to markdown",
    "docx to markdown",
    "convert word to md",
    "docx to md",
    "word document to markdown",
    "doc to markdown converter",
  ],
  alternates: { canonical: "https://www.easytoconvert.in/word-to-markdown" },
  openGraph: {
    title: "Free Word to Markdown Converter – DOCX to .md Online | EasyToConvert",
    description:
      "Convert Word .docx files to clean GitHub-Flavoured Markdown in your browser. Tables, headings, and lists preserved. Free, private, no sign-up.",
    url: "https://www.easytoconvert.in/word-to-markdown",
    images: [{ url: "/og-image.png", width: 1200, height: 630, alt: "EasyToConvert" }],
  },
};

export default function WordToMarkdownLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
