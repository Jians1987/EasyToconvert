import type { Metadata } from "next";

// page.tsx is a client component and cannot export metadata itself, so the
// route's SEO lives here. Without this the page silently inherited the
// site-wide default title and description.
export const metadata: Metadata = {
  title: "Free Table Extractor – PDF & Image Tables to Excel, CSV, JSON",
  description:
    "Detect tables in any PDF or image with Microsoft's Table Transformer and export them to Excel, CSV, or JSON. Detection runs in your browser — free, no sign-up.",
  keywords: [
    "extract table from PDF",
    "PDF table to Excel",
    "table detection",
    "image table to CSV",
    "Table Transformer",
    "PDF to CSV",
  ],
  alternates: { canonical: "https://www.easytoconvert.in/table-detect" },
  openGraph: {
    title: "Free Table Extractor – PDF & Image Tables to Excel, CSV, JSON | EasyToConvert",
    description:
      "Detect tables in any PDF or image with Microsoft's Table Transformer and export them to Excel, CSV, or JSON. Free, no sign-up.",
    url: "https://www.easytoconvert.in/table-detect",
    images: [{ url: "/og-image.png", width: 1200, height: 630, alt: "EasyToConvert" }],
  },
};

export default function TableDetectLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
