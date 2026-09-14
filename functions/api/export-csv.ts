// functions/api/export-csv.ts
// Pro-gated CSV export of the current leaderboard. Returns 403 for non-Pro so
// the data (and the file) never reach a free user — server-enforced, not UI.
import { getAuthStatus, type AuthEnv } from "../_lib/auth";

const DATA_BASE = "https://data-api.polymarket.com";

interface Env extends AuthEnv {
  EXPORT_LIMIT?: string;
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

  try {
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
    const csv = [header.join(","), ...lines].join("\n");

    return new Response(csv, {
      status: 200,
      headers: {
        "content-type": "text/csv;charset=utf-8",
        "content-disposition": `attachment; filename="polymarket-whales-${new Date().toISOString().slice(0, 10)}.csv"`,
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
