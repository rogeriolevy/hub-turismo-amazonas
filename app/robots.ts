import type { MetadataRoute } from "next";
export default function robots(): MetadataRoute.Robots {
  return {
    rules: { userAgent: "*", allow: "/", disallow: ["/admin", "/api/"] },
    sitemap: "https://hub-turismo-amazonas.chirpy-tick-5066.chatgpt.site/sitemap.xml",
  };
}
