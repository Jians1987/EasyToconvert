import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { Providers } from "./providers";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";

const inter = Inter({ subsets: ["latin"], variable: "--font-sans" });

export const metadata: Metadata = {
  title: "Easytoconvert - Free Online Converters, Formatting, and Developer Tools",
  description:
    "A privacy-first, fast-loading platform for PDF tools, image converters, JSON/XML data tools, formatting, code utilities, and developer productivity tools.",
  keywords: [
    "file converter",
    "PDF tools",
    "image converter",
    "JSON beautifier",
    "CSV to JSON",
    "base64 encoder",
    "developer utilities",
  ],
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
};


export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="dark">
      <body className={`${inter.variable} font-sans antialiased bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-50`}>
        <Providers>
          <div className="flex flex-col min-h-screen bg-gradient-mesh bg-fixed">
            <Navbar />
            <main className="flex-grow pt-20 pb-12 px-4 max-w-7xl mx-auto w-full">
              {children}
            </main>
            <Footer />
          </div>
        </Providers>
      </body>
    </html>
  );
}
