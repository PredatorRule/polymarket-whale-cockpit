// functions/api/wallet.ts
// On-demand lookup for ANY public Polymarket wallet (e.g. "check my own
// wallet"). Returns the same NormalizedWhale shape as /api/whales for one
// address, so the frontend can render it in the leaderboard/drawer.

const DATA_BASE = "https://data-api.polymarket.com";

interface Env {
  WALLET_CACHE_SECONDS?: string;
}

type Json = Record<string, unknown>;

function n(v: unknown, d = 0): number {
  const x = typeof v === "string" ? Number(v) : v;
  return typeof x === "number" && Number.isFinite(x) ? x : d;
}
function s(v: unknown, d = ""): string {
  return typeof v === "string" ? v : d;
}
function pickN(o: Json, keys: string[], d = 0): number {
  for (const k of keys) if (o[k] !== undefined && o[k] !== null) return n(o[k], d);
  return d;
}
function pickS(o: Json, keys: string[], d = ""): string {
  for (const k of keys) if (typeof o[k] === "string" && o[k]) return o[k] as string;
  return d;
}
function toOutcome(v: unknown): "YES" | "NO" {
  return String(v ?? "YES").toUpperCase() === "NO" ? "NO" : "YES";
}

async function getJson(url: string, cacheTtl: number): Promise<unknown> {
  const res = await fetch(url, {
    headers: { accept: "application/json", "user-agent": "whale-cockpit/1.0" },
    cf: { cacheTtl, cacheEverything: true },
  } as RequestInit);
  if (!res.ok) throw new Error(`${url} -> ${res.status}`);
  return res.json();
}

export const onRequest = async (context: {
  request: Request;
  env: Env;
}): Promise<Response> => {
  const { request, env } = context;
  const cacheSeconds = Number(env.WALLET_CACHE_SECONDS ?? "120") || 120;
  const headers: Record<string, string> = {
    "content-type": "application/json",
    "cache-control": `public, max-age=${cacheSeconds}`,
    "access-control-allow-origin": "*",
  };

  const url = new URL(request.url);
  const address = (url.searchParams.get("address") ?? "").trim().toLowerCase();
  if (!/^0x[0-9a-f]{40}$/.test(address)) {
    return new Response(
      JSON.stringify({ ok: false, reason: "invalid_address", whale: null }),
      { status: 200, headers },
    );
  }

  try {
    const [positionsRaw, closedRaw, tradesRaw, valueRaw] = await Promise.all([
      getJson(`${DATA_BASE}/positions?user=${address}&sizeThreshold=0&limit=500&sortBy=CURRENT&sortDirection=DESC`, cacheSeconds).catch(() => []),
      getJson(`${DATA_BASE}/closed-positions?user=${address}&limit=500&sortBy=TIMESTAMP&sortDirection=DESC`, cacheSeconds).catch(() => []),
      getJson(`${DATA_BASE}/trades?user=${address}&limit=1&takerOnly=false`, cacheSeconds).catch(() => []),
      getJson(`${DATA_BASE}/value?user=${address}`, cacheSeconds).catch(() => null),
    ]);

    const positionRows = Array.isArray(positionsRaw) ? (positionsRaw as Json[]) : [];
    const closedRows = Array.isArray(closedRaw) ? (closedRaw as Json[]) : [];
    const tradeRows = Array.isArray(tradesRaw) ? (tradesRaw as Json[]) : [];

    // Positions
    const positions = positionRows.map((r) => {
      const avgPrice = n(r.avgPrice ?? r.avg_price);
      const currentPrice = n(r.curPrice ?? r.currentPrice ?? avgPrice);
      const shares = n(r.size ?? r.shares);
      return {
        marketTitle: s(r.title ?? r.market ?? r.slug, "Untitled market"),
        outcome: toOutcome(r.outcome),
        shares,
        avgPrice,
        currentPrice,
        pnl: n(r.cashPnl ?? r.cash_pnl),
        pnlPercent: n(r.percentPnl ?? r.percent_pnl),
        totalCost: n(r.initialValue ?? r.total_cost, shares * avgPrice),
      };
    });
    const topBet =
      positions.length > 0
        ? positions.reduce((best, p) =>
            p.currentPrice * p.shares > best.currentPrice * best.shares ? p : best,
          )
        : null;

    // Closed-position stats
    const pnl = closedRows.map((r) => n(r.realizedPnl ?? r.realized_pnl ?? r.pnl));
    const wins = pnl.filter((v) => v > 1e-9).length;
    const losses = pnl.filter((v) => v < -1e-9).length;
    const closedTotal = pnl.length;
    const realizedPnl = pnl.reduce((a, b) => a + b, 0);
    const ordered = [...closedRows].sort((a, b) => n(a.timestamp) - n(b.timestamp));
    let cum = 0, peak = 0, dd = 0;
    for (const r of ordered) {
      cum += n(r.realizedPnl ?? r.realized_pnl ?? r.pnl);
      peak = Math.max(peak, cum);
      dd = Math.max(dd, peak - cum);
    }

    const openValueUsdc = positionRows.reduce((sum, r) => sum + n(r.currentValue ?? r.current_value), 0);
    const cashPnl = positionRows.reduce((sum, r) => sum + n(r.cashPnl ?? r.cash_pnl), 0);
    // Total PnL best-effort: value endpoint if present, else realized + open cash.
    const totalPnl =
      valueRaw && typeof valueRaw === "object" && (valueRaw as Json).pnl !== undefined
        ? n((valueRaw as Json).pnl)
        : realizedPnl + cashPnl;

    const lastTradeTs = tradeRows.length > 0 ? pickN(tradeRows[0], ["timestamp"]) : 0;

    const whale = {
      address,
      name: undefined as string | undefined,
      totalPnl,
      pnl30d: 0,
      pnl7d: 0,
      totalVolume: 0, // not derivable cheaply for an arbitrary wallet
      leaderRankAll: 0, // unknown unless on the leaderboard
      winRate: closedTotal ? (wins / closedTotal) * 100 : 0,
      wins,
      losses,
      maxDrawdownUsdc: dd,
      activePositionsCount: positionRows.length,
      openValueUsdc,
      positions: positions.slice(0, 8),
      topBet,
      lastTradeTs,
    };

    return new Response(JSON.stringify({ ok: true, whale }), { status: 200, headers });
  } catch (err) {
    return new Response(
      JSON.stringify({
        ok: false,
        reason: "fetch_error",
        message: err instanceof Error ? err.message : "unknown",
        whale: null,
      }),
      { status: 200, headers },
    );
  }
};
