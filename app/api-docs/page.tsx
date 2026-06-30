import type { Metadata } from "next";
import { ApiDocsPageClient } from "./PageClient";

export const metadata: Metadata = {
  title: "API Documentation | EasyToConvert",
  description:
    "Read the EasyToConvert API documentation to learn how to integrate our tools into your own applications.",
  alternates: { canonical: "https://www.easytoconvert.in/api-docs" },
  openGraph: {
    title: "API Documentation | EasyToConvert",
    description:
      "Read the EasyToConvert API documentation to learn how to integrate our tools into your own applications.",
    url: "https://www.easytoconvert.in/api-docs",
    images: [{ url: "/og-image.png", width: 1200, height: 630, alt: "EasyToConvert" }],
  },
};

export default function ApiDocsPage() {
  return <ApiDocsPageClient />;
}
