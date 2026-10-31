import type { Metadata, Viewport } from "next";
import "./globals.css";
import { Providers } from "./providers";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import Script from "next/script";
import { Analytics } from "@vercel/analytics/next";

const siteUrl = "https://www.easytoconvert.in";

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: {
    default: "EasyToConvert – Free Online PDF, Image & Developer Tools",
    template: "%s | EasyToConvert",
  },
  description:
    "Free, privacy-first online tools: merge/split/edit PDFs, convert images, beautify JSON & CSV, generate QR codes, run OCR, compress media, and more. Local-first processing with clearly marked, opt-in cloud AI features.",
  keywords: [
    "free PDF converter",
    "PDF to Word",
    "PDF to Excel",
    "merge PDF",
    "split PDF",
    "image converter",
    "compress image",
    "resize image",
    "JSON beautifier",
    "CSV to JSON",
    "base64 encoder",
    "QR code generator",
    "developer tools",
    "online OCR",
    "compress video",
    "compress audio",
    "PDF editor",
    "free online tools",
    "no upload tools",
    "browser tools",
    "easytoconvert",
  ],
  authors: [{ name: "EasyToConvert", url: siteUrl }],
  creator: "EasyToConvert",
  publisher: "EasyToConvert",
  category: "Technology",
  applicationName: "EasyToConvert",
  referrer: "origin-when-cross-origin",
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-video-preview": -1,
      "max-image-preview": "large",
      "max-snippet": -1,
    },
  },
  openGraph: {
    type: "website",
    locale: "en_IN",
    url: siteUrl,
    siteName: "EasyToConvert",
    title: "EasyToConvert – Free Online PDF, Image & Developer Tools",
    description:
      "Free, privacy-first online tools: merge/split/edit PDFs, convert images, beautify JSON, generate QR codes, and more. Local-first processing with clearly marked, opt-in cloud AI features.",
    images: [
      {
        url: "/og-image.png",
        width: 1200,
        height: 630,
        alt: "EasyToConvert – Free Online Converter Tools",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "EasyToConvert – Free Online PDF, Image & Developer Tools",
    description:
      "Merge PDFs, convert images, beautify JSON, generate QR codes and more — 100% free, local-first processing with opt-in cloud AI.",
    images: ["/og-image.png"],
    creator: "@easytoconvert",
  },
  alternates: {
    canonical: siteUrl,
  },
  icons: {
    icon: [
      { url: "/favicon.ico", sizes: "any" },
      { url: "/icon.svg", type: "image/svg+xml" },
    ],
    apple: "/apple-touch-icon.png",
  },
  manifest: "/manifest.json",
  // Set GOOGLE_SITE_VERIFICATION / BING_SITE_VERIFICATION to the codes from Search Console / Bing Webmaster Tools.
  verification: {
    ...(process.env.GOOGLE_SITE_VERIFICATION ? { google: process.env.GOOGLE_SITE_VERIFICATION } : {}),
    ...(process.env.BING_SITE_VERIFICATION ? { other: { "msvalidate.01": process.env.BING_SITE_VERIFICATION } } : {}),
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f8fafc" },
    { media: "(prefers-color-scheme: dark)", color: "#020617" },
  ],
};

// JSON-LD structured data for the website
const websiteJsonLd = {
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "WebSite",
      "@id": `${siteUrl}/#website`,
      url: siteUrl,
      name: "EasyToConvert",
      description:
        "Free, privacy-first online tools for PDF conversion, image editing, developer utilities, and more.",
      publisher: { "@id": `${siteUrl}/#organization` },
      inLanguage: "en-IN",
    },
    {
      "@type": "Organization",
      "@id": `${siteUrl}/#organization`,
      name: "EasyToConvert",
      url: siteUrl,
      logo: {
        "@type": "ImageObject",
        inLanguage: "en-IN",
        url: `${siteUrl}/og-image.png`,
        contentUrl: `${siteUrl}/og-image.png`,
        width: 1200,
        height: 630,
        caption: "EasyToConvert",
      },
      image: { "@id": `${siteUrl}/og-image.png` },
      sameAs: ["https://github.com/Jians1987/EasyToconvert"],
    },
    {
      "@type": "WebApplication",
      "@id": `${siteUrl}/#webapp`,
      name: "EasyToConvert",
      url: siteUrl,
      applicationCategory: "UtilitiesApplication",
      operatingSystem: "Any",
      browserRequirements: "Requires JavaScript",
      offers: {
        "@type": "Offer",
        price: "0",
        priceCurrency: "INR",
      },
      featureList: [
        "Merge, split, rotate, protect and edit PDF files",
        "Compress PDF and convert PDF to Word, Excel, JPG",
        "Compress, resize, and convert images",
        "JSON / CSV / XML data formatting tools",
        "QR code, password and UUID generators, Base64 and URL encoders",
        "JavaScript, CSS and HTML minifiers, CSS gradient and box-shadow generators",
        "AI-powered PDF summarizer and OCR",
        "Audio compression, video-to-MP3 extraction and audio trimming via FFmpeg.wasm",
        "All processing done locally in the browser",
      ],
    },
  ],
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="dark">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
      </head>
      <body
        className={`font-sans antialiased bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-50`}
      >
        {/* JSON-LD Structured Data */}
        <Script
          id="website-jsonld"
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(websiteJsonLd) }}
          strategy="beforeInteractive"
        />
        <Providers>
          <div className="flex flex-col min-h-screen bg-gradient-mesh bg-fixed">
            <Navbar />
            <main className="flex-grow pt-20 pb-12 px-4 max-w-7xl mx-auto w-full">
              {children}
            </main>
            <Footer />
          </div>
        </Providers>
        {/* Privacy-friendly, cookie-free page analytics; only loads on Vercel deployments. */}
        {process.env.VERCEL === "1" && <Analytics />}
      </body>
    </html>
  );
}
