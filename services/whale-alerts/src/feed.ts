// services/whale-alerts/src/feed.ts
import type { RawTrade, WhaleTrade } from "./types";
import { normalizeTrade } from "./format";

const DATA_BASE = "https://data-api.polymarket.com";

async function getJson(url: string): Promise<unknown> {
  const res = await fetch(url, {
    headers: { accept: "application/json", "user-agent": "whale-alerts/1.0" },
  });
  if (!res.ok) throw new Error(`${url} -> ${res.status}`);
  return res.json();
}

/** Top-N wallets from the public all-time leaderboard. */
export async function fetchTopWallets(topN: number): Promise<string[]> {
  const url = `${DATA_BASE}/v1/leaderboard?timePeriod=ALL&orderBy=PNL&limit=${topN}`;
  try {
    const payload = (await getJson(url)) as unknown;
    const rows = Array.isArray(payload) ? (payload as Record<string, unknown>[]) : [];
    return rows
      .map((r) =>
        String(r.proxyWallet ?? r.wallet ?? r.user ?? r.address ?? "").toLowerCase(),
      )
      .filter((w) => /^0x[0-9a-f]{40}$/.test(w));
  } catch {
    return [];
  }
}

/**
 * Recent trades for one wallet, newest first. Only trades within the lookback
 * window and at/above the notional floor are returned as normalized WhaleTrades.
 */
export async function fetchRecentTrades(
  wallet: string,
  sinceTs: number,
  minNotionalUsd: number,
): Promise<WhaleTrade[]> {
  const url = `${DATA_BASE}/trades?user=${wallet}&limit=100&takerOnly=false`;
  let rows: RawTrade[] = [];
  try {
    const payload = (await getJson(url)) as unknown;
    rows = Array.isArray(payload) ? (payload as RawTrade[]) : [];
  } catch {
    return [];
  }

  const out: WhaleTrade[] = [];
  for (const raw of rows) {
    const t = normalizeTrade(raw);
    if (!t) continue;
    if (t.timestamp < sinceTs) continue;
    if (t.notionalUsd < minNotionalUsd) continue;
    out.push(t);
  }
  return out;
}
