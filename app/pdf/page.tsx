import type { Metadata } from "next";
import { PdfPageClient } from "./PageClient";

export const metadata: Metadata = {
  title: "Free PDF Tools – Merge, Split, Edit, Convert PDF Online | EasyToConvert",
  description:
    "Merge, split, rotate, password-protect, and convert PDFs to Word, Excel, or JPG — all free, in your browser. No file uploads, no data stored.",
  keywords: [
    "merge PDF",
    "split PDF",
    "PDF to Word",
    "PDF to Excel",
    "PDF editor",
    "rotate PDF",
    "compress PDF",
    "free PDF tools",
  ],
  alternates: { canonical: "https://www.easytoconvert.in/pdf" },
  openGraph: {
    title: "Free PDF Tools – Merge, Split, Edit, Convert PDF Online | EasyToConvert",
    description:
      "Merge, split, rotate, password-protect, and convert PDFs to Word, Excel, or JPG — all free, in your browser. No file uploads, no data stored.",
    url: "https://www.easytoconvert.in/pdf",
    images: [{ url: "/og-image.png", width: 1200, height: 630, alt: "EasyToConvert" }],
  },
};

export default function PdfPage() {
  return <PdfPageClient />;
}
