import type { Metadata } from "next";

// Internal price-list tool, not part of the public converter product. Kept
// reachable by direct link but excluded from search engines and the sitemap.
export const metadata: Metadata = {
  title: "Internal Tool",
  robots: { index: false, follow: false },
};

export default function MobilLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
