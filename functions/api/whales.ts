// functions/api/whales.ts
// Cloudflare Pages Function — server-side proxy to the Apify Edge Audit actor.
//
// WHY THIS EXISTS: the browser must never hold the Apify token (it would be
// public) and must never trigger paid actor runs on page load. This function
// runs on the server, holds the token as a secret, and READS the latest
// already-computed dataset (reading stored results is free; only running the
// actor costs money). The frontend calls /api/whales and gets normalized JSON.
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
const CACHE_SECONDS = 300; // 5 min edge cache; keeps actor reads minimal

type Json = Record<string, unknown>;

function num(v: unknown, fallback = 0): number {
  const n = typeof v === "string" ? Number(v) : v;
  return typeof n === "number" && Number.isFinite(n) ? n : fallback;
}

function str(v: unknown, fallback = ""): string {
  return typeof v === "string" ? v : fallback;
}

/** Pull the first present numeric field from a list of candidate keys. */
function pick(obj: Json, keys: string[], fallback = 0): number {
  for (const k of keys) {
    if (obj[k] !== undefined && obj[k] !== null) return num(obj[k], fallback);
  }
  return fallback;
}

function pickStr(obj: Json, keys: string[], fallback = ""): string {
  for (const k of keys) {
    if (typeof obj[k] === "string" && obj[k]) return obj[k] as string;
  }
  return fallback;
}

/**
 * Defensive normalizer: the Edge Audit record is rich and its exact field
 * names may evolve, so we probe several plausible keys and degrade gracefully
 * rather than throwing. Unknown fields simply fall back to safe defaults.
 */
function normalizeAudit(record: Json, index: number): Json {
  const address = pickStr(record, ["wallet", "address", "proxyWallet", "walletAddress"]);
  const totalPnl = pick(record, ["totalPnl", "total_pnl", "pnl", "realizedPnl", "netPnl"]);
  const pnl30d = pick(record, ["pnl30d", "pnl_30d", "pnl30", "monthlyPnl"], totalPnl);
  const pnl7d = pick(record, ["pnl7d", "pnl_7d", "pnl7", "weeklyPnl"], 0);
  const winRate = pick(record, ["winRate", "win_rate", "winShare", "win_share"]);
  const wins = pick(record, ["wins", "winCount", "win_count"]);
  const losses = pick(record, ["losses", "lossCount", "loss_count"]);
  const totalVolume = pick(record, ["totalVolume", "total_volume", "volume", "notional"]);
  const activePositionsCount = pick(record, [
    "activePositionsCount",
    "openPositions",
    "open_positions_count",
    "openPositionsCount",
  ]);

  return {
    address,
    ensName: pickStr(record, ["ensName", "ens", "label", "handle"]) || undefined,
    totalPnl,
    pnl30d,
    pnl7d,
    winRate: winRate > 1 ? winRate : winRate * 100, // accept 0..1 or 0..100
    wins,
    losses,
    totalVolume,
    activePositionsCount,
    // Raw record preserved so the client adapter can dig deeper if needed.
    _raw: record,
    _index: index,
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
    // No token configured → tell the client to use its bundled mock data.
    return new Response(
      JSON.stringify({ ok: false, reason: "no_token", whales: [] }),
      { status: 200, headers },
    );
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
      .map((r, i) => normalizeAudit(r, i))
      .filter((w) => typeof w.address === "string" && (w.address as string).length > 0);

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
