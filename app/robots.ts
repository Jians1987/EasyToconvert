import type { MetadataRoute } from "next";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        // Don't block /_next/: Google needs the JS and CSS to render pages.
        disallow: ["/api/", "/dashboard"],
      },
    ],
    sitemap: "https://www.easytoconvert.in/sitemap.xml",
    host: "https://www.easytoconvert.in",
  };
}
