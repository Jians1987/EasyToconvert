import type { Metadata } from "next";
import { MobilPageClient } from "./PageClient";

// Internal price-list utility: kept out of search results so it doesn't dilute
// what search engines see the site as being about.
export const metadata: Metadata = {
  title: "Mobil Lubricants Price Matrix",
  robots: { index: false, follow: false },
};

export default function MobilPage() {
  return <MobilPageClient />;
}
