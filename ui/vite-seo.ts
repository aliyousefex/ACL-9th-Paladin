import { loadEnv, type Plugin } from "vite";

/**
 * Search and sharing tags that need the site's public address (the canonical link, og:url, an absolute share image, the
 * sitemap) are written in index.html with this token and filled in at build time. When the address is not known (a local
 * build, or a host that does not tell us) those tags are left out instead of pointing at a wrong or relative URL.
 */
export const SITE_TOKEN = "__SITE_URL__";

/** The deployed site's address without a trailing slash, from VITE_SITE_URL / SITE_URL or Vercel's production host; null when unknown. */
export function siteUrl(env: Record<string, string | undefined>): string | null {
  const vercel = env.VERCEL_PROJECT_PRODUCTION_URL;
  const raw = (env.VITE_SITE_URL || env.SITE_URL || (vercel ? `https://${vercel}` : "")).trim();
  return /^https?:\/\/[^\s/]+/i.test(raw) ? raw.replace(/\/+$/, "") : null;
}

/** Fill the token in, or drop the lines that cannot be right without it. The share image keeps a site-relative path as a fallback. */
export function injectSite(html: string, url: string | null): string {
  return html
    .split("\n")
    .flatMap((line) => {
      if (!line.includes(SITE_TOKEN)) return [line];
      if (url) return [line.split(SITE_TOKEN).join(url)];
      if (line.includes("/og-card.png")) return [line.split(SITE_TOKEN).join("")];
      return [];
    })
    .join("\n");
}

export function robotsTxt(url: string | null): string {
  return ["User-agent: *", "Allow: /", ...(url ? ["", `Sitemap: ${url}/sitemap.xml`] : []), ""].join("\n");
}

/**
 * The site is one page with hash routes, and crawlers ignore the part after "#", so the address of the page is the only thing
 * a sitemap can honestly list.
 */
export function sitemapXml(url: string): string {
  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n  <url>\n    <loc>${url}/</loc>\n  </url>\n</urlset>\n`;
}

export function seo(): Plugin {
  let url: string | null = null;
  return {
    name: "paladin-seo",
    configResolved(config) {
      url = siteUrl({ ...loadEnv(config.mode, config.root, ""), ...process.env });
    },
    transformIndexHtml: (html) => injectSite(html, url),
    generateBundle() {
      this.emitFile({ type: "asset", fileName: "robots.txt", source: robotsTxt(url) });
      if (url) this.emitFile({ type: "asset", fileName: "sitemap.xml", source: sitemapXml(url) });
    },
  };
}
