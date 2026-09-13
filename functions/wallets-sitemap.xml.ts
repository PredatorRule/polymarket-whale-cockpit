// functions/wallets-sitemap.xml.ts
// Dynamic sitemap of the current top wallets' SSR pages, so search engines can
// discover and index /wallet/<address> pages beyond internal links.

interface Env {
  WALLETS_SITEMAP_LIMIT?: string;
}

const DATA_BASE = "https://data-api.polymarket.com";
const ORIGIN = "https://polymarket-whale-cockpit.pages.dev";

export const onRequest = async (context: { env: Env }): Promise<Response> => {
  const limit = Math.min(Math.max(Number(context.env.WALLETS_SITEMAP_LIMIT ?? "50") || 50, 1), 100);
  const headers = {
    "content-type": "application/xml; charset=utf-8",
    "cache-control": "public, max-age=3600",
  };

  let addresses: string[] = [];
  try {
    const res = await fetch(
      `${DATA_BASE}/v1/leaderboard?timePeriod=ALL&orderBy=PNL&limit=${limit}`,
      { headers: { accept: "application/json" }, cf: { cacheTtl: 3600, cacheEverything: true } } as RequestInit,
    );
    if (res.ok) {
      const rows = (await res.json()) as Record<string, unknown>[];
      if (Array.isArray(rows)) {
        addresses = rows
          .map((r) => String(r.proxyWallet ?? r.wallet ?? r.user ?? "").toLowerCase())
          .filter((a) => /^0x[0-9a-f]{40}$/.test(a));
      }
    }
  } catch {
    addresses = [];
  }

  const urls = addresses
    .map((a) => `  <url><loc>${ORIGIN}/wallet/${a}</loc><changefreq>daily</changefreq><priority>0.6</priority></url>`)
    .join("\n");

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls}
</urlset>`;

  return new Response(xml, { status: 200, headers });
};
