// functions/api/whales.ts
// Cloudflare Pages Function — calls Polymarket's PUBLIC APIs directly.
//
// No Apify, no token, no cost. Server-to-server fetch (no browser CORS limit).
// Ports the audit logic from the Apify actor's core.py:
//   - data-api /v1/leaderboard  -> ranked wallets + official PnL + volume
//   - data-api /closed-positions -> realized PnL rows => win rate, W/L, drawdown
//   - data-api /positions        -> open positions => active count + value
//
// Results are edge-cached so repeat visitors don't refan the requests.
//
// Optional env:
//   LEADERBOARD_LIMIT (default "20")   how many top wallets to build
//   WHALES_CACHE_SECONDS (default "600")

const DATA_BASE = "https://data-api.polymarket.com";

interface Env {
  LEADERBOARD_LIMIT?: string;
  WHALES_CACHE_SECONDS?: string;
}

type Json = Record<string, unknown>;

function n(v: unknown, d = 0): number {
  const x = typeof v === "string" ? Number(v) : v;
  return typeof x === "number" && Number.isFinite(x) ? x : d;
}
function s(v: unknown, d = ""): string {
  return typeof v === "string" ? v : d;
}
/** First present value across candidate keys. */
function pickN(o: Json, keys: string[], d = 0): number {
  for (const k of keys) if (o[k] !== undefined && o[k] !== null) return n(o[k], d);
  return d;
}
function pickS(o: Json, keys: string[], d = ""): string {
  for (const k of keys) if (typeof o[k] === "string" && o[k]) return o[k] as string;
  return d;
}

async function getJson(url: string): Promise<unknown> {
  const res = await fetch(url, {
    headers: { accept: "application/json", "user-agent": "whale-cockpit/1.0" },
    cf: { cacheTtl: 300, cacheEverything: true },
  } as RequestInit);
  if (!res.ok) throw new Error(`${url} -> ${res.status}`);
  return res.json();
}

interface LeaderRow {
  wallet: string;
  pnl: number;
  volume: number;
  rank: number;
  name?: string;
}

/** Fetch a ranked leaderboard page for one period. */
async function leaderboard(period: "DAY" | "WEEK" | "MONTH" | "ALL", limit: number): Promise<LeaderRow[]> {
  const url = `${DATA_BASE}/v1/leaderboard?timePeriod=${period}&orderBy=PNL&limit=${limit}`;
  const payload = (await getJson(url)) as unknown;
  const rows = Array.isArray(payload) ? (payload as Json[]) : [];
  return rows.map((r, i) => ({
    wallet: pickS(r, ["proxyWallet", "wallet", "user", "address", "walletAddress"]).toLowerCase(),
    pnl: pickN(r, ["pnl", "pnl_usdc", "pnlUsdc", "profit"]),
    volume: pickN(r, ["vol", "volume", "volume_usdc", "volumeUsdc"]),
    rank: pickN(r, ["rank"], i + 1),
    name: pickS(r, ["name", "pseudonym", "ensName", "displayName"]) || undefined,
  }));
}

interface WinStats {
  winRate: number;
  wins: number;
  losses: number;
  maxDrawdownUsdc: number;
  closedRows: number;
}

/** Closed-positions -> win rate / W-L / drawdown (ports summarize_closed). */
async function closedStats(wallet: string): Promise<WinStats> {
  const url = `${DATA_BASE}/closed-positions?user=${wallet}&limit=500&sortBy=TIMESTAMP&sortDirection=DESC`;
  let rows: Json[] = [];
  try {
    const payload = (await getJson(url)) as unknown;
    rows = Array.isArray(payload) ? (payload as Json[]) : [];
  } catch {
    rows = [];
  }
  const pnl = rows.map((r) => n(r.realizedPnl ?? r.realized_pnl ?? r.pnl));
  const wins = pnl.filter((v) => v > 1e-9).length;
  const losses = pnl.filter((v) => v < -1e-9).length;
  const total = pnl.length;

  // Max drawdown over the realized-PnL sequence (oldest -> newest).
  const ordered = [...rows].sort(
    (a, b) => n(a.timestamp) - n(b.timestamp),
  );
  let cum = 0, peak = 0, dd = 0;
  for (const r of ordered) {
    cum += n(r.realizedPnl ?? r.realized_pnl ?? r.pnl);
    peak = Math.max(peak, cum);
    dd = Math.max(dd, peak - cum);
  }

  return {
    winRate: total ? (wins / total) * 100 : 0,
    wins,
    losses,
    maxDrawdownUsdc: dd,
    closedRows: total,
  };
}

export interface ApiPosition {
  marketTitle: string;
  outcome: "YES" | "NO";
  shares: number;
  avgPrice: number; // 0..1
  currentPrice: number; // 0..1
  pnl: number;
  pnlPercent: number;
  totalCost: number;
}

interface OpenStats {
  positionRows: number;
  currentValueUsdc: number;
  cashPnlUsdc: number;
  positions: ApiPosition[];
  topBet: ApiPosition | null;
}

function toOutcome(v: unknown): "YES" | "NO" {
  return String(v ?? "YES").toUpperCase() === "NO" ? "NO" : "YES";
}

/** Open-positions -> active count, value, AND real per-position rows. */
async function openStats(wallet: string): Promise<OpenStats> {
  const url = `${DATA_BASE}/positions?user=${wallet}&sizeThreshold=0&limit=500&sortBy=CURRENT&sortDirection=DESC`;
  let rows: Json[] = [];
  try {
    const payload = (await getJson(url)) as unknown;
    rows = Array.isArray(payload) ? (payload as Json[]) : [];
  } catch {
    rows = [];
  }

  const positions: ApiPosition[] = rows.map((r) => {
    const avgPrice = n(r.avgPrice ?? r.avg_price);
    const currentPrice = n(r.curPrice ?? r.currentPrice ?? avgPrice);
    const shares = n(r.size ?? r.shares);
    const totalCost = n(r.initialValue ?? r.total_cost, shares * avgPrice);
    return {
      marketTitle: s(r.title ?? r.market ?? r.slug, "Untitled market"),
      outcome: toOutcome(r.outcome),
      shares,
      avgPrice,
      currentPrice,
      pnl: n(r.cashPnl ?? r.cash_pnl),
      pnlPercent: n(r.percentPnl ?? r.percent_pnl),
      totalCost,
    };
  });

  // Highest-value current position = the "top bet".
  const topBet =
    positions.length > 0
      ? positions.reduce((best, p) =>
          p.currentPrice * p.shares > best.currentPrice * best.shares ? p : best,
        )
      : null;

  return {
    positionRows: rows.length,
    currentValueUsdc: rows.reduce((sum, r) => sum + n(r.currentValue ?? r.current_value), 0),
    cashPnlUsdc: rows.reduce((sum, r) => sum + n(r.cashPnl ?? r.cash_pnl), 0),
    positions,
    topBet,
  };
}

export interface NormalizedWhale {
  address: string;
  name?: string;
  totalPnl: number;
  pnl30d: number;
  pnl7d: number;
  totalVolume: number;
  leaderRankAll: number;
  winRate: number;
  wins: number;
  losses: number;
  maxDrawdownUsdc: number;
  activePositionsCount: number;
  openValueUsdc: number;
  positions: ApiPosition[];
  topBet: ApiPosition | null;
}

export const onRequest = async (context: { env: Env }): Promise<Response> => {
  const { env } = context;
  const limit = Math.min(Math.max(Number(env.LEADERBOARD_LIMIT ?? "20") || 20, 1), 50);
  const cacheSeconds = Number(env.WHALES_CACHE_SECONDS ?? "600") || 600;
  const headers: Record<string, string> = {
    "content-type": "application/json",
    "cache-control": `public, max-age=${cacheSeconds}`,
    "access-control-allow-origin": "*",
  };

  try {
    // Ranked lists for three horizons in parallel.
    const [all, month, week] = await Promise.all([
      leaderboard("ALL", limit),
      leaderboard("MONTH", limit).catch(() => [] as LeaderRow[]),
      leaderboard("WEEK", limit).catch(() => [] as LeaderRow[]),
    ]);

    if (all.length === 0) {
      return new Response(JSON.stringify({ ok: false, reason: "empty_leaderboard", whales: [] }), {
        status: 200,
        headers,
      });
    }

    const monthByWallet = new Map(month.map((r) => [r.wallet, r.pnl]));
    const weekByWallet = new Map(week.map((r) => [r.wallet, r.pnl]));

    // Per-wallet closed/open stats in parallel (bounded by `limit`).
    const enriched = await Promise.all(
      all.map(async (row): Promise<NormalizedWhale> => {
        const [cs, os] = await Promise.all([closedStats(row.wallet), openStats(row.wallet)]);
        return {
          address: row.wallet,
          name: row.name,
          totalPnl: row.pnl,
          pnl30d: monthByWallet.get(row.wallet) ?? 0,
          pnl7d: weekByWallet.get(row.wallet) ?? 0,
          totalVolume: row.volume,
          leaderRankAll: row.rank,
          winRate: cs.winRate,
          wins: cs.wins,
          losses: cs.losses,
          maxDrawdownUsdc: cs.maxDrawdownUsdc,
          activePositionsCount: os.positionRows,
          openValueUsdc: os.currentValueUsdc,
          positions: os.positions.slice(0, 8),
          topBet: os.topBet,
        };
      }),
    );

    return new Response(
      JSON.stringify({ ok: true, reason: "live", count: enriched.length, whales: enriched }),
      { status: 200, headers },
    );
  } catch (err) {
    return new Response(
      JSON.stringify({
        ok: false,
        reason: "fetch_error",
        message: err instanceof Error ? err.message : "unknown",
        whales: [],
      }),
      { status: 200, headers },
    );
  }
};
