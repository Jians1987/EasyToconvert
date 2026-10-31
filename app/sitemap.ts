import type { MetadataRoute } from "next";
import { toolPages } from "./lib/toolPages";
import { blogPosts } from "./lib/blogPosts";

const baseUrl = "https://www.easytoconvert.in";
// Bump when page content meaningfully changes. A fixed date (not the build time)
// keeps lastmod trustworthy, so search engines keep using it.
const CONTENT_UPDATED = "2026-10-30";

// /dashboard (blocked in robots.txt) and /mobil (noindex) are deliberately excluded.
const hubs: [path: string, priority: number][] = [
  ["/pdf", 0.8], ["/image", 0.8], ["/data", 0.7], ["/developer", 0.7], ["/javascript", 0.6],
  ["/ai", 0.7], ["/media", 0.6], ["/table-detect", 0.7],
];
const pages: [path: string, priority: number][] = [["/blog", 0.6], ["/api-docs", 0.5], ["/about", 0.4], ["/contact", 0.3]];

export default function sitemap(): MetadataRoute.Sitemap {
  return [
    { url: baseUrl, lastModified: CONTENT_UPDATED, changeFrequency: "weekly", priority: 1 },
    ...toolPages.map((t) => ({ url: `${baseUrl}/${t.slug}`, lastModified: CONTENT_UPDATED, changeFrequency: "monthly" as const, priority: 0.9 })),
    ...hubs.map(([path, priority]) => ({ url: `${baseUrl}${path}`, lastModified: CONTENT_UPDATED, changeFrequency: "monthly" as const, priority })),
    ...blogPosts.map((p) => ({ url: `${baseUrl}/blog/${p.slug}`, lastModified: p.updated ?? p.published, changeFrequency: "yearly" as const, priority: 0.6 })),
    ...pages.map(([path, priority]) => ({ url: `${baseUrl}${path}`, lastModified: CONTENT_UPDATED, changeFrequency: "monthly" as const, priority })),
  ];
}
