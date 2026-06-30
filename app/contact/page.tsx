import type { Metadata } from "next";
import { ContactPageClient } from "./PageClient";

export const metadata: Metadata = {
  title: "Contact Us | EasyToConvert",
  description:
    "Get in touch with the EasyToConvert team. We'd love to hear your feedback, feature requests, or questions.",
  alternates: { canonical: "https://www.easytoconvert.in/contact" },
  openGraph: {
    title: "Contact Us | EasyToConvert",
    description:
      "Get in touch with the EasyToConvert team. We'd love to hear your feedback, feature requests, or questions.",
    url: "https://www.easytoconvert.in/contact",
    images: [{ url: "/og-image.png", width: 1200, height: 630, alt: "EasyToConvert" }],
  },
};

export default function ContactPage() {
  return <ContactPageClient />;
}
