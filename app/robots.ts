import type { MetadataRoute } from "next";
import { siteUrl } from "@/lib/site-config";
export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: ["/admin", "/api/", "/minha-conta", "/painel/", "/entrar", "/cadastro"],
    },
    sitemap: `${siteUrl}/sitemap.xml`,
  };
}
