import type { Metadata } from "next";
import { DeveloperPageClient } from "./PageClient";

export const metadata: Metadata = {
  title: "Free Developer Tools – QR Generator, Hash, Base64, UUID | EasyToConvert",
  description:
    "Free developer utilities: QR code generator, MD5/SHA256 hash generator, Base64 encoder/decoder, UUID generator, color picker, and more.",
  keywords: [
    "QR code generator",
    "Base64 encoder",
    "SHA256 hash",
    "UUID generator",
    "developer utilities",
    "online dev tools",
  ],
  alternates: { canonical: "https://www.easytoconvert.in/developer" },
  openGraph: {
    title: "Free Developer Tools – QR Generator, Hash, Base64, UUID | EasyToConvert",
    description:
      "Free developer utilities: QR code generator, MD5/SHA256 hash generator, Base64 encoder/decoder, UUID generator, color picker, and more.",
    url: "https://www.easytoconvert.in/developer",
    images: [{ url: "/og-image.png", width: 1200, height: 630, alt: "EasyToConvert" }],
  },
};

export default function DeveloperPage() {
  return <DeveloperPageClient />;
}
