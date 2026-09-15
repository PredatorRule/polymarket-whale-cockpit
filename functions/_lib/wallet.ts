// functions/_lib/wallet.ts
// Shared wallet-audit fetch used by /api/wallet (JSON) and /wallet/[address]
// (SSR HTML). Files under _lib are not routed by Cloudflare Pages.
import { deriveStrategy, type WalletStrategy } from "./strategy";

const DATA_BASE = "https://data-api.polymarket.com";

type Json = Record<string, unknown>;

export function n(v: unknown, d = 0): number {
  const x = typeof v === "string" ? Number(v) : v;
  return typeof x === "number" && Number.isFinite(x) ? x : d;
}
export function s(v: unknown, d = ""): string {
  return typeof v === "string" ? v : d;
}
function pickN(o: Json, keys: string[], d = 0): number {
  for (const k of keys) if (o[k] !== undefined && o[k] !== null) return n(o[k], d);
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

export interface WalletPosition {
  marketTitle: string;
  outcome: "YES" | "NO";
  shares: number;
  avgPrice: number;
  currentPrice: number;
  pnl: number;
  pnlPercent: number;
  totalCost: number;
}

export interface WalletAudit {
  address: string;
  totalPnl: number;
  winRate: number;
  wins: number;
  losses: number;
  maxDrawdownUsdc: number;
  activePositionsCount: number;
  openValueUsdc: number;
  positions: WalletPosition[];
  topBet: WalletPosition | null;
  lastTradeTs: number;
  strategy: WalletStrategy;
}

export function isAddress(a: string): boolean {
  return /^0x[0-9a-f]{40}$/.test(a);
}

/** Fetch a full public audit for one wallet from Polymarket's public APIs. */
export async function auditWallet(address: string, cacheTtl = 120): Promise<WalletAudit | null> {
  const addr = address.trim().toLowerCase();
  if (!isAddress(addr)) return null;

  const [positionsRaw, closedRaw, tradesRaw, valueRaw] = await Promise.all([
    getJson(`${DATA_BASE}/positions?user=${addr}&sizeThreshold=0&limit=500&sortBy=CURRENT&sortDirection=DESC`, cacheTtl).catch(() => []),
    getJson(`${DATA_BASE}/closed-positions?user=${addr}&limit=500&sortBy=TIMESTAMP&sortDirection=DESC`, cacheTtl).catch(() => []),
    getJson(`${DATA_BASE}/trades?user=${addr}&limit=1&takerOnly=false`, cacheTtl).catch(() => []),
    getJson(`${DATA_BASE}/value?user=${addr}`, cacheTtl).catch(() => null),
  ]);

  const positionRows = Array.isArray(positionsRaw) ? (positionsRaw as Json[]) : [];
  const closedRows = Array.isArray(closedRaw) ? (closedRaw as Json[]) : [];
  const tradeRows = Array.isArray(tradesRaw) ? (tradesRaw as Json[]) : [];

  const positions: WalletPosition[] = positionRows.map((r) => {
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
  const totalPnl =
    valueRaw && typeof valueRaw === "object" && (valueRaw as Json).pnl !== undefined
      ? n((valueRaw as Json).pnl)
      : realizedPnl + cashPnl;

  const lastTradeTs = tradeRows.length > 0 ? pickN(tradeRows[0], ["timestamp"]) : 0;

  // Derived trading-style archetype + edge metrics (computed by us).
  const strategy = deriveStrategy({
    positions: positions.map((p) => ({
      totalCost: p.totalCost,
      avgPrice: p.avgPrice,
      currentPrice: p.currentPrice,
      shares: p.shares,
    })),
    openValueUsdc,
    openPnlUsdc: cashPnl,
    realizedPnls: pnl,
  });

  return {
    address: addr,
    totalPnl,
    winRate: closedTotal ? (wins / closedTotal) * 100 : 0,
    wins,
    losses,
    maxDrawdownUsdc: dd,
    activePositionsCount: positionRows.length,
    openValueUsdc,
    positions: positions.slice(0, 8),
    topBet,
    lastTradeTs,
    strategy,
  };
}
