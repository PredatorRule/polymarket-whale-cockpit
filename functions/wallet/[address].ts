// functions/wallet/[address].ts
// SSR, crawlable per-wallet page. Server-renders real audit data into HTML with
// per-wallet <title>, meta description, OpenGraph, and JSON-LD, so Google can
// index each wallet — unlike the client-only ?wallet= deep link.
import { auditWallet, isAddress, type WalletAudit } from "../_lib/wallet";

interface Env {
  WALLET_CACHE_SECONDS?: string;
}

const ORIGIN = "https://polymarket-whale-cockpit.pages.dev";

function esc(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
function mask(a: string): string {
  return `${a.slice(0, 6)}…${a.slice(-4)}`;
}
function usd(v: number): string {
  const sign = v < 0 ? "-" : "";
  const abs = Math.abs(v);
  if (abs >= 1_000_000) return `${sign}$${(abs / 1_000_000).toFixed(2)}M`;
  if (abs >= 1_000) return `${sign}$${(abs / 1_000).toFixed(1)}K`;
  return `${sign}$${abs.toFixed(0)}`;
}
function signedUsd(v: number): string {
  return `${v > 0 ? "+" : ""}${usd(v)}`;
}
function pct(v: number): string {
  return `${v.toFixed(1)}%`;
}

function renderHtml(a: WalletAudit): string {
  const label = mask(a.address);
  const pnlStr = signedUsd(a.totalPnl);
  const pnlColor = a.totalPnl >= 0 ? "#34d399" : "#fb7185";
  const title = `${label} — Polymarket Wallet: ${pnlStr} PnL, ${pct(a.winRate)} Win Rate`;
  const desc =
    `Polymarket wallet ${label}: ${pnlStr} total PnL, ${pct(a.winRate)} win rate ` +
    `(${a.wins}W-${a.losses}L), ${a.activePositionsCount} open positions worth ` +
    `${usd(a.openValueUsdc)}. Live public on-chain audit — win rate, drawdown, and positions.`;
  const url = `${ORIGIN}/wallet/${a.address}`;
  const ogImg = `${ORIGIN}/og-image.png`;

  const rows = a.positions
    .map(
      (p) => `
      <tr>
        <td>${esc(p.marketTitle)}</td>
        <td class="mono ${p.outcome === "YES" ? "yes" : "no"}">${p.outcome}</td>
        <td class="mono right">${usd(p.totalCost)}</td>
        <td class="mono right" style="color:${p.pnl >= 0 ? "#34d399" : "#fb7185"}">${signedUsd(p.pnl)}</td>
      </tr>`,
    )
    .join("");

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "ProfilePage",
    name: `Polymarket Wallet ${label}`,
    description: desc,
    url,
  };

  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>${esc(title)}</title>
    <meta name="description" content="${esc(desc)}" />
    <link rel="canonical" href="${url}" />
    <meta property="og:type" content="profile" />
    <meta property="og:title" content="${esc(title)}" />
    <meta property="og:description" content="${esc(desc)}" />
    <meta property="og:url" content="${url}" />
    <meta property="og:image" content="${ogImg}" />
    <meta name="twitter:card" content="summary_large_image" />
    <meta name="twitter:title" content="${esc(title)}" />
    <meta name="twitter:description" content="${esc(desc)}" />
    <meta name="twitter:image" content="${ogImg}" />
    <script type="application/ld+json">${JSON.stringify(jsonLd)}</script>
    <style>
      :root { color-scheme: dark; }
      * { box-sizing: border-box; }
      body { margin: 0; background: #09090b; color: #e4e4e7; font-family: ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, sans-serif; line-height: 1.6; }
      .wrap { max-width: 860px; margin: 0 auto; padding: 40px 20px 80px; }
      a { color: #38bdf8; text-decoration: none; }
      a:hover { text-decoration: underline; }
      .mono { font-family: ui-monospace, "SF Mono", Menlo, monospace; }
      .right { text-align: right; }
      .yes { color: #34d399; } .no { color: #fb7185; }
      h1 { font-size: 1.6rem; margin: 4px 0 2px; color: #fafafa; }
      .addr { color: #71717a; font-size: 0.85rem; }
      .grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 12px; margin: 24px 0; }
      @media (min-width: 640px) { .grid { grid-template-columns: repeat(4, 1fr); } }
      .card { border: 1px solid #27272a; background: #121215; border-radius: 12px; padding: 14px 16px; }
      .card .k { font-size: 0.7rem; text-transform: uppercase; letter-spacing: 0.05em; color: #71717a; }
      .card .v { font-size: 1.3rem; font-weight: 700; margin-top: 4px; }
      table { width: 100%; border-collapse: collapse; margin-top: 12px; font-size: 0.9rem; }
      th, td { text-align: left; padding: 8px 10px; border-bottom: 1px solid #1f1f23; }
      th { color: #71717a; font-size: 0.7rem; text-transform: uppercase; }
      .eyebrow { font-family: ui-monospace, monospace; font-size: 0.72rem; letter-spacing: 0.2em; text-transform: uppercase; color: #34d399; }
      .cta { display: inline-block; margin-top: 24px; padding: 10px 16px; border-radius: 10px; background: #06b6d4; color: #06202a; font-weight: 600; }
      footer { margin-top: 48px; padding-top: 20px; border-top: 1px solid #27272a; font-size: 0.8rem; color: #52525b; }
    </style>
  </head>
  <body>
    <div class="wrap">
      <span class="eyebrow">Polymarket Wallet Audit · Live</span>
      <h1>Wallet ${label}</h1>
      <div class="addr mono">${a.address} · <a href="https://polymarket.com/profile/${a.address}" target="_blank" rel="noopener noreferrer">View on Polymarket ↗</a></div>

      <div class="grid">
        <div class="card"><div class="k">Total PnL</div><div class="v mono" style="color:${pnlColor}">${pnlStr}</div></div>
        <div class="card"><div class="k">Win Rate</div><div class="v mono">${pct(a.winRate)}</div><div class="addr mono">${a.wins}W-${a.losses}L</div></div>
        <div class="card"><div class="k">Open Positions</div><div class="v mono">${a.activePositionsCount}</div></div>
        <div class="card"><div class="k">Open Value</div><div class="v mono" style="color:#38bdf8">${usd(a.openValueUsdc)}</div></div>
      </div>

      ${
        a.positions.length > 0
          ? `<h2 style="font-size:1.1rem;color:#fafafa;">Open positions</h2>
      <table>
        <thead><tr><th>Market</th><th>Side</th><th class="right">Size</th><th class="right">PnL</th></tr></thead>
        <tbody>${rows}</tbody>
      </table>`
          : `<p style="color:#71717a">No open positions found for this wallet.</p>`
      }

      <a class="cta" href="${ORIGIN}/?wallet=${a.address}">Open in the live cockpit →</a>

      <footer>
        Independent tool, not affiliated with Polymarket. Data from public
        on-chain APIs; not financial advice. · <a href="${ORIGIN}/">Whale leaderboard</a>
        · <a href="${ORIGIN}/faq">FAQ</a>
      </footer>
    </div>
  </body>
</html>`;
}

function notFoundHtml(address: string): string {
  return `<!doctype html><html lang="en"><head><meta charset="UTF-8"/>
<meta name="viewport" content="width=device-width, initial-scale=1.0"/>
<title>Wallet not found — Polymarket Whale Cockpit</title>
<meta name="robots" content="noindex" />
<style>body{background:#09090b;color:#e4e4e7;font-family:system-ui;margin:0}.w{max-width:640px;margin:0 auto;padding:80px 20px;text-align:center}a{color:#38bdf8}</style>
</head><body><div class="w"><h1>Wallet not found</h1>
<p>No public Polymarket data for <code>${esc(address)}</code>.</p>
<p><a href="${ORIGIN}/">← Back to the whale leaderboard</a></p></div></body></html>`;
}

export const onRequest = async (context: {
  params: { address: string };
  env: Env;
}): Promise<Response> => {
  const { params, env } = context;
  const cacheSeconds = Number(env.WALLET_CACHE_SECONDS ?? "300") || 300;
  const address = String(params.address ?? "").trim().toLowerCase();

  if (!isAddress(address)) {
    return new Response(notFoundHtml(address), {
      status: 404,
      headers: { "content-type": "text/html; charset=utf-8" },
    });
  }

  try {
    const audit = await auditWallet(address, cacheSeconds);
    if (!audit) {
      return new Response(notFoundHtml(address), {
        status: 404,
        headers: { "content-type": "text/html; charset=utf-8" },
      });
    }
    return new Response(renderHtml(audit), {
      status: 200,
      headers: {
        "content-type": "text/html; charset=utf-8",
        "cache-control": `public, max-age=${cacheSeconds}`,
      },
    });
  } catch {
    return new Response(notFoundHtml(address), {
      status: 502,
      headers: { "content-type": "text/html; charset=utf-8" },
    });
  }
};
