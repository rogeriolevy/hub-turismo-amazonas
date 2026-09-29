import type { MetadataRoute } from "next";
import { siteUrl } from "@/lib/site-config";
export default function sitemap(): MetadataRoute.Sitemap {
  return ["", "/privacidade"].map((path) => ({
    url: `${siteUrl}${path}`,
    changeFrequency: "monthly",
    priority: path ? 0.3 : 1,
  }));
}
