import type { MetadataRoute } from "next";
export default function sitemap(): MetadataRoute.Sitemap {
  return ["", "/privacidade"].map((path) => ({
    url: "https://hub-turismo-amazonas.chirpy-tick-5066.chatgpt.site" + path,
    changeFrequency: "monthly",
    priority: path ? 0.3 : 1,
  }));
}
