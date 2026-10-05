import type { MetadataRoute } from "next";
import { siteUrl } from "@/lib/site-config";
import { getDatabase } from "@/db";
import { publicCatalogPaths } from "@/server/catalog-service";
import { directoryCategories, publicProviders } from "@/server/cadastur/public-directory";
export const dynamic = "force-dynamic";
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const db = getDatabase();
  const [catalogPaths, providerPaths] = await Promise.all([
    publicCatalogPaths(db),
    Promise.all(
      directoryCategories.map(async (category) =>
        (await publicProviders(db, category)).map((entry) => "/prestadores/" + entry.id),
      ),
    ),
  ]);
  return [
    "",
    "/privacidade",
    ...directoryCategories
      .filter((category) => category !== "guias")
      .map((category) => "/" + category),
    "/experiencias",
    "/navegacao",
    ...catalogPaths,
    ...providerPaths.flat(),
  ].map((path) => ({
    url: `${siteUrl}${path}`,
    changeFrequency: "monthly",
    priority: path ? 0.3 : 1,
  }));
}
