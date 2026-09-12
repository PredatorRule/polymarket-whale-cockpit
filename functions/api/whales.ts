// functions/api/whales.ts
// Cloudflare Pages Function — server-side proxy to the Apify Edge Audit actor.
//
// The browser must never hold the Apify token, and page loads must never
// trigger PAID actor runs. This function holds the token as a secret and READS
// the actor's last successful dataset (reading stored results is free; only
// running the actor costs money). The frontend calls /api/whales.
//
// Parses the REAL Edge Audit schema (verified against the actor source):
//   { wallet, leaderboard:{day,week,month,all:{rank,pnl_usdc,volume_usdc}},
//     open_positions:{position_rows,current_value_usdc,cash_pnl_usdc,...},
//     closed_positions:{realized_pnl_usdc,profitable_row_rate,winning_rows,
//       losing_rows,profit_factor,max_drawdown_closed_pnl_sequence_usdc,
//       top_10pct_winners_share_of_gross_profit,...},
//     trade_sample:{sample_turnover_usdc,maker_share_by_count,observed_behavior,
//       two_sided_buy_markets,...}, fee_sample, risk_flags, data_quality }
//
// Required Pages secret (Settings → Environment variables, encrypted):
//   APIFY_TOKEN = <your Apify API token>
// Optional:
//   APIFY_ACTOR = redfoxxie~polymarket-wallet-edge-audit  (default below)

interface Env {
  APIFY_TOKEN?: string;
  APIFY_ACTOR?: string;
}

const DEFAULT_ACTOR = "redfoxxie~polymarket-wallet-edge-audit";
const CACHE_SECONDS = 300;

type Json = Record<string, unknown>;

function obj(v: unknown): Json {
  return v && typeof v === "object" ? (v as Json) : {};
}
function num(v: unknown, fallback = 0): number {
  const n = typeof v === "string" ? Number(v) : v;
  return typeof n === "number" && Number.isFinite(n) ? n : fallback;
}
function str(v: unknown, fallback = ""): string {
  return typeof v === "string" ? v : fallback;
}

/** Normalized flat shape the client adapter consumes. */
export interface NormalizedWhale {
  address: string;
  totalPnl: number;
  pnl30d: number;
  pnl7d: number;
  winRate: number; // 0..100
  wins: number;
  losses: number;
  totalVolume: number;
  activePositionsCount: number;
  openValueUsdc: number;
  makerSharePct: number;
  profitFactor: number | null;
  maxDrawdownUsdc: number;
  concentrationPct: number | null;
  observedBehavior: string;
  leaderRankAll: number | null;
  riskFlags: string[];
  scannedAt: string;
}

function normalizeAudit(record: Json): NormalizedWhale {
  const leaderboard = obj(record.leaderboard);
  const all = obj(leaderboard.all);
  const month = obj(leaderboard.month);
  const week = obj(leaderboard.week);
  const open = obj(record.open_positions);
  const closed = obj(record.closed_positions);
  const trade = obj(record.trade_sample);

  // Prefer official leaderboard PnL; fall back to closed realized + open cash.
  const closedRealized = num(closed.realized_pnl_usdc);
  const openCash = num(open.cash_pnl_usdc);
  const totalPnl =
    all.pnl_usdc !== undefined ? num(all.pnl_usdc) : closedRealized + openCash;

  const totalVolume =
    all.volume_usdc !== undefined
      ? num(all.volume_usdc)
      : num(trade.sample_turnover_usdc);

  const profitableRate = num(closed.profitable_row_rate, 0); // 0..1
  const makerShare = num(trade.maker_share_by_count, 0); // 0..1

  return {
    address: str(record.wallet),
    totalPnl,
    pnl30d: month.pnl_usdc !== undefined ? num(month.pnl_usdc) : 0,
    pnl7d: week.pnl_usdc !== undefined ? num(week.pnl_usdc) : 0,
    winRate: profitableRate > 1 ? profitableRate : profitableRate * 100,
    wins: num(closed.winning_rows),
    losses: num(closed.losing_rows),
    totalVolume,
    activePositionsCount: num(open.position_rows),
    openValueUsdc: num(open.current_value_usdc),
    makerSharePct: makerShare > 1 ? makerShare : makerShare * 100,
    profitFactor:
      closed.profit_factor === null || closed.profit_factor === undefined
        ? null
        : num(closed.profit_factor),
    maxDrawdownUsdc: num(closed.max_drawdown_closed_pnl_sequence_usdc),
    concentrationPct:
      closed.top_10pct_winners_share_of_gross_profit === null ||
      closed.top_10pct_winners_share_of_gross_profit === undefined
        ? null
        : num(closed.top_10pct_winners_share_of_gross_profit) * 100,
    observedBehavior: str(trade.observed_behavior),
    leaderRankAll: all.rank !== undefined ? num(all.rank) : null,
    riskFlags: Array.isArray(record.risk_flags)
      ? (record.risk_flags as unknown[]).map((f) => String(f))
      : [],
    scannedAt: str(record.scanned_at_iso),
  };
}

export const onRequest = async (context: {
  request: Request;
  env: Env;
}): Promise<Response> => {
  const { env } = context;
  const headers: Record<string, string> = {
    "content-type": "application/json",
    "cache-control": `public, max-age=${CACHE_SECONDS}`,
    "access-control-allow-origin": "*",
  };

  if (!env.APIFY_TOKEN) {
    return new Response(JSON.stringify({ ok: false, reason: "no_token", whales: [] }), {
      status: 200,
      headers,
    });
  }

  const actor = env.APIFY_ACTOR || DEFAULT_ACTOR;
  const url =
    `https://api.apify.com/v2/acts/${actor}/runs/last/dataset/items` +
    `?token=${encodeURIComponent(env.APIFY_TOKEN)}&status=SUCCEEDED&clean=true`;

  try {
    const res = await fetch(url, { headers: { accept: "application/json" } });
    if (!res.ok) {
      return new Response(
        JSON.stringify({ ok: false, reason: `apify_${res.status}`, whales: [] }),
        { status: 200, headers },
      );
    }
    const items = (await res.json()) as unknown;
    const rows = Array.isArray(items) ? (items as Json[]) : [];
    const whales = rows
      .map(normalizeAudit)
      .filter((w) => w.address.length > 0);

    return new Response(
      JSON.stringify({ ok: true, reason: "live", count: whales.length, whales }),
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
