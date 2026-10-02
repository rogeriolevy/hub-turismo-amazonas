const localHosts = new Set(["localhost", "127.0.0.1", "[::1]"]);

export function trustedSiteOrigins(siteUrl: string | URL) {
  const site = siteUrl instanceof URL ? siteUrl : new URL(siteUrl);
  const origins = new Set([site.origin]);

  // Local Next.js runs are often opened as localhost even when SITE_URL uses 127.0.0.1.
  // Accept only loopback aliases on the configured port; production remains exact-origin only.
  if (site.protocol === "http:" && localHosts.has(site.hostname)) {
    const port = site.port ? ":" + site.port : "";
    for (const host of localHosts) origins.add("http://" + host + port);
  }

  return [...origins];
}
