// functions/api/export-csv.ts
// Pro-gated CSV export. Returns 403 for non-Pro so the data (and the file)
// never reach a free user — server-enforced, not UI.
//
//   ?type=leaderboard  (default) -> ranked wallets by all-time PnL
//   ?type=moves                  -> recent large whale trades (the live feed)
import { getAuthStatus, type AuthEnv } from "../_lib/auth";

const DATA_BASE = "https://data-api.polymarket.com";

interface Env extends AuthEnv {
  EXPORT_LIMIT?: string;
  MOVES_MIN_NOTIONAL?: string;
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
function csvEscape(v: string | number): string {
  const s = String(v);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}
function toOutcome(v: unknown): "YES" | "NO" {
  return String(v ?? "YES").toUpperCase() === "NO" ? "NO" : "YES";
}

/** Build the leaderboard CSV (ranked wallets). */
async function leaderboardCsv(limit: number): Promise<string> {
  const res = await fetch(
    `${DATA_BASE}/v1/leaderboard?timePeriod=ALL&orderBy=PNL&limit=${limit}`,
    { headers: { accept: "application/json" }, cf: { cacheTtl: 60, cacheEverything: true } } as RequestInit,
  );
  if (!res.ok) throw new Error(`leaderboard -> ${res.status}`);
  const rows = (await res.json()) as Json[];
  const list = Array.isArray(rows) ? rows : [];

  const header = ["rank", "wallet", "name", "pnl_usdc", "volume_usdc"];
  const lines = list.map((r, i) =>
    [
      pickN(r, ["rank"], i + 1),
      pickS(r, ["proxyWallet", "wallet", "user"]).toLowerCase(),
      pickS(r, ["name", "pseudonym"]),
      pickN(r, ["pnl", "pnl_usdc", "profit"]).toFixed(2),
      pickN(r, ["vol", "volume", "volume_usdc"]).toFixed(2),
    ]
      .map(csvEscape)
      .join(","),
  );
  return [header.join(","), ...lines].join("\n");
}

/** Build the whale-movements CSV (recent large trades). */
async function movesCsv(minNotional: number, limit: number): Promise<string> {
  const url =
    `${DATA_BASE}/trades?limit=500&takerOnly=false` +
    `&filterType=CASH&filterAmount=${Math.floor(minNotional)}`;
  const res = await fetch(url, {
    headers: { accept: "application/json", "user-agent": "whale-cockpit/1.0" },
    cf: { cacheTtl: 45, cacheEverything: true },
  } as RequestInit);
  if (!res.ok) throw new Error(`trades -> ${res.status}`);
  const payload = (await res.json()) as unknown;
  const rows = Array.isArray(payload) ? (payload as Json[]) : [];

  interface Row {
    ts: number;
    wallet: string;
    name: string;
    action: string;
    outcome: string;
    title: string;
    notional: number;
    price: number;
  }
  const out: Row[] = [];
  for (const r of rows) {
    const wallet = pickS(r, ["proxyWallet", "wallet", "user"]).toLowerCase();
    const price = pickN(r, ["price"]);
    const shares = pickN(r, ["size", "shares"]);
    if (!wallet || price <= 0 || shares <= 0) continue;
    const notional = price * shares;
    if (notional < minNotional) continue;
    const side = pickS(r, ["side"]).toUpperCase() === "SELL" ? "SELL" : "BUY";
    const outcome = toOutcome(r.outcome);
    out.push({
      ts: pickN(r, ["timestamp"]),
      wallet,
      name: pickS(r, ["name", "pseudonym"]),
      action: side === "SELL" ? `SOLD ${outcome}` : `BOUGHT ${outcome}`,
      outcome,
      title: pickS(r, ["title", "market"], "Untitled market"),
      notional,
      price,
    });
  }
  out.sort((a, b) => b.ts - a.ts);
  const capped = out.slice(0, limit);

  const header = ["timestamp_utc", "wallet", "name", "action", "market", "notional_usd", "price"];
  const lines = capped.map((m) =>
    [
      new Date(m.ts * 1000).toISOString(),
      m.wallet,
      m.name,
      m.action,
      m.title,
      m.notional.toFixed(2),
      m.price.toFixed(4),
    ]
      .map(csvEscape)
      .join(","),
  );
  return [header.join(","), ...lines].join("\n");
}

export const onRequest = async (context: {
  request: Request;
  env: Env;
}): Promise<Response> => {
  const { request, env } = context;
  const auth = await getAuthStatus(request, env);

  // Hard gate: only Pro may export.
  if (!auth.isPro) {
    return new Response(
      JSON.stringify({ ok: false, error: "pro_required" }),
      {
        status: 403,
        headers: { "content-type": "application/json", "cache-control": "no-store" },
      },
    );
  }

  const limit = Math.min(Math.max(Number(env.EXPORT_LIMIT ?? "100") || 100, 1), 500);
  const type = new URL(request.url).searchParams.get("type") === "moves" ? "moves" : "leaderboard";
  const minNotional = Number(env.MOVES_MIN_NOTIONAL ?? "5000") || 5000;
  const date = new Date().toISOString().slice(0, 10);
  const filename =
    type === "moves"
      ? `polymarket-whale-moves-${date}.csv`
      : `polymarket-whale-leaderboard-${date}.csv`;

  try {
    const csv =
      type === "moves"
        ? await movesCsv(minNotional, limit)
        : await leaderboardCsv(limit);

    return new Response(csv, {
      status: 200,
      headers: {
        "content-type": "text/csv;charset=utf-8",
        "content-disposition": `attachment; filename="${filename}"`,
        "cache-control": "private, no-store",
      },
    });
  } catch (err) {
    return new Response(
      JSON.stringify({ ok: false, error: err instanceof Error ? err.message : "unknown" }),
      { status: 502, headers: { "content-type": "application/json", "cache-control": "no-store" } },
    );
  }
};
