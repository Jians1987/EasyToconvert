import type { Metadata } from "next";
import { DataPageClient } from "./PageClient";

export const metadata: Metadata = {
  title: "Free Data Tools – JSON Beautifier, CSV to JSON, XML Formatter | EasyToConvert",
  description:
    "Format, validate, and convert JSON, CSV, and XML data online for free. Beautify messy JSON, convert CSV to JSON, minify data, and more.",
  keywords: [
    "JSON beautifier",
    "CSV to JSON",
    "XML formatter",
    "JSON validator",
    "data converter",
    "online data tools",
  ],
  alternates: { canonical: "https://www.easytoconvert.in/data" },
  openGraph: {
    title: "Free Data Tools – JSON Beautifier, CSV to JSON, XML Formatter | EasyToConvert",
    description:
      "Format, validate, and convert JSON, CSV, and XML data online for free. Beautify messy JSON, convert CSV to JSON, minify data, and more.",
    url: "https://www.easytoconvert.in/data",
    images: [{ url: "/og-image.png", width: 1200, height: 630, alt: "EasyToConvert" }],
  },
};

export default function DataPage() {
  return <DataPageClient />;
}
