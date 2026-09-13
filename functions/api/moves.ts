// functions/api/moves.ts
// Dedicated endpoint for the live "whale movements" feed. Kept separate from
// /api/whales so it has its own Cloudflare subrequest budget (free plan caps
// ~50 subrequests per invocation) — this makes ONE upstream call and is fast.

const DATA_BASE = "https://data-api.polymarket.com";

interface Env {
  MOVES_MIN_NOTIONAL?: string;
  MOVES_CACHE_SECONDS?: string;
}

type Json = Record<string, unknown>;

function n(v: unknown, d = 0): number {
  const x = typeof v === "string" ? Number(v) : v;
  return typeof x === "number" && Number.isFinite(x) ? x : d;
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

export interface RecentMove {
  wallet: string;
  name?: string;
  action: string;
  outcome: "YES" | "NO";
  title: string;
  eventUrl: string;
  notionalUsd: number;
  priceUsd: number;
  timestamp: number;
}

export const onRequest = async (context: { env: Env }): Promise<Response> => {
  const { env } = context;
  const minNotional = Number(env.MOVES_MIN_NOTIONAL ?? "5000") || 5000;
  const cacheSeconds = Number(env.MOVES_CACHE_SECONDS ?? "45") || 45;
  const headers: Record<string, string> = {
    "content-type": "application/json",
    "cache-control": `public, max-age=${cacheSeconds}`,
    "access-control-allow-origin": "*",
  };

  const url =
    `${DATA_BASE}/trades?limit=500&takerOnly=false` +
    `&filterType=CASH&filterAmount=${Math.floor(minNotional)}`;

  try {
    const res = await fetch(url, {
      headers: { accept: "application/json", "user-agent": "whale-cockpit/1.0" },
      cf: { cacheTtl: cacheSeconds, cacheEverything: true },
    } as RequestInit);
    if (!res.ok) throw new Error(`trades -> ${res.status}`);
    const payload = (await res.json()) as unknown;
    const rows = Array.isArray(payload) ? (payload as Json[]) : [];

    const moves: RecentMove[] = [];
    for (const r of rows) {
      const wallet = pickS(r, ["proxyWallet", "wallet", "user"]).toLowerCase();
      const price = pickN(r, ["price"]);
      const shares = pickN(r, ["size", "shares"]);
      if (!wallet || price <= 0 || shares <= 0) continue;
      const notional = price * shares;
      if (notional < minNotional) continue;
      const side = pickS(r, ["side"]).toUpperCase() === "SELL" ? "SELL" : "BUY";
      const outcome = toOutcome(r.outcome);
      const eventSlug = pickS(r, ["eventSlug", "slug"]);
      moves.push({
        wallet,
        name: pickS(r, ["name", "pseudonym"]) || undefined,
        action: side === "SELL" ? `SOLD ${outcome}` : `BOUGHT ${outcome}`,
        outcome,
        title: pickS(r, ["title", "market"], "Untitled market"),
        eventUrl: eventSlug
          ? `https://polymarket.com/event/${eventSlug}`
          : `https://polymarket.com/profile/${wallet}`,
        notionalUsd: notional,
        priceUsd: price,
        timestamp: pickN(r, ["timestamp"]),
      });
    }
    moves.sort((a, b) => b.timestamp - a.timestamp);

    return new Response(
      JSON.stringify({ ok: true, count: moves.length, moves: moves.slice(0, 30) }),
      { status: 200, headers },
    );
  } catch (err) {
    return new Response(
      JSON.stringify({ ok: false, message: err instanceof Error ? err.message : "unknown", moves: [] }),
      { status: 200, headers },
    );
  }
};
