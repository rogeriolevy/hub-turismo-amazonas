import type { MetadataRoute } from "next";
import { siteUrl } from "@/lib/site-config";
import { getDatabase } from "@/db";
import { publicCatalogPaths } from "@/server/catalog-service";
import { directoryCategories, publicProviders } from "@/server/cadastur/public-directory";
export const dynamic = "force-dynamic";
export default function sitemap(): MetadataRoute.Sitemap {
  return [
    "",
    "/privacidade",
    ...directoryCategories
      .filter((category) => category !== "guias")
      .map((category) => "/" + category),
    "/experiencias",
    "/navegacao",
    ...publicCatalogPaths(getDatabase()),
    ...directoryCategories.flatMap((category) =>
      publicProviders(getDatabase(), category).map((entry) => "/prestadores/" + entry.id),
    ),
  ].map((path) => ({
    url: `${siteUrl}${path}`,
    changeFrequency: "monthly",
    priority: path ? 0.3 : 1,
  }));
}
