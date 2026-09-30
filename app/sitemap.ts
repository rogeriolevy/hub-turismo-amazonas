import type { MetadataRoute } from "next";
import { siteUrl } from "@/lib/site-config";
import { getDatabase } from "@/db";
import { publicCatalogPaths } from "@/server/catalog-service";
export const dynamic = "force-dynamic";
export default function sitemap(): MetadataRoute.Sitemap {
  return [
    "",
    "/privacidade",
    "/hospedagens",
    "/passeios",
    ...publicCatalogPaths(getDatabase()),
  ].map((path) => ({
    url: `${siteUrl}${path}`,
    changeFrequency: "monthly",
    priority: path ? 0.3 : 1,
  }));
}
