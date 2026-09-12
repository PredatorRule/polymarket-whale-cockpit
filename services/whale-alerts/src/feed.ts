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

/**
 * Global recent trades across the whole platform, filtered by notional.
 * This is the correct primitive for a live whale-MOVEMENT feed: it surfaces
 * large trades happening right now regardless of wallet, instead of polling
 * all-time PnL leaders who are often dormant.
 */
export async function fetchGlobalWhaleTrades(
  sinceTs: number,
  minNotionalUsd: number,
  limit = 500,
): Promise<WhaleTrade[]> {
  // filterType=CASH + filterAmount asks the API for trades >= a USD size.
  const url =
    `${DATA_BASE}/trades?limit=${limit}&takerOnly=false` +
    `&filterType=CASH&filterAmount=${Math.floor(minNotionalUsd)}`;
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
    if (t.notionalUsd < minNotionalUsd) continue; // defensive re-check
    out.push(t);
  }
  return out;
}

/**
 * Recent trades for one wallet, newest first. Only trades within the lookback
 * window and at/above the notional floor are returned as normalized WhaleTrades.
 * Used only in explicit WATCH_WALLETS mode.
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
