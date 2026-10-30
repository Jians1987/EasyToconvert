import type { Metadata } from "next";
import { TableDetectPageClient } from "./PageClient";

const description =
  "Detect and extract tables from PDFs, scans and screenshots into CSV or Excel. Free, with on-device table detection that runs in your browser.";

export const metadata: Metadata = {
  title: "Extract Tables from PDF & Images to Excel or CSV – Free",
  description,
  alternates: { canonical: "https://www.easytoconvert.in/table-detect" },
  openGraph: {
    title: "Extract Tables from PDF & Images to Excel or CSV – Free",
    description,
    url: "https://www.easytoconvert.in/table-detect",
    images: [{ url: "/og-image.png", width: 1200, height: 630, alt: "EasyToConvert" }],
  },
};

export default function TableDetectPage() {
  return <TableDetectPageClient />;
}
