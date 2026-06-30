import type { MetadataRoute } from "next";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        disallow: ["/api/", "/_next/", "/dashboard"],
      },
    ],
    sitemap: "https://www.easytoconvert.in/sitemap.xml",
    host: "https://www.easytoconvert.in",
  };
}
