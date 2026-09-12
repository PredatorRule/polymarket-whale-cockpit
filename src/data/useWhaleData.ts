// src/data/useWhaleData.ts
// Loads whale data from the /api/whales Pages Function (live Apify audit data)
// and falls back to bundled mock data when the API is unconfigured or empty.
import { useEffect, useState } from "react";
import type { WhaleTrader, WhaleCategory, Outcome, WhalePosition } from "../types/whale";
import { mockWhales } from "./mockWhales";

export type DataSource = "live" | "demo" | "loading";

// Matches NormalizedWhale in functions/api/whales.ts
interface ApiWhale {
  address: string;
  totalPnl: number;
  pnl30d: number;
  pnl7d: number;
  winRate: number;
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

interface ApiResponse {
  ok: boolean;
  reason: string;
  whales: ApiWhale[];
}

const CATEGORIES: WhaleCategory[] = ["Politics", "Macro", "Crypto", "Pop Culture"];

/** Deterministic category from the address (the audit doesn't classify markets). */
function categoryFor(address: string): WhaleCategory {
  let h = 0;
  for (let i = 0; i < address.length; i++) h = (h * 31 + address.charCodeAt(i)) >>> 0;
  return CATEGORIES[h % CATEGORIES.length];
}

/** Build badges from REAL audit metrics. */
function badgesFor(w: ApiWhale): string[] {
  const b: string[] = [];
  if (w.leaderRankAll !== null && w.leaderRankAll > 0 && w.leaderRankAll <= 100)
    b.push(`Leaderboard #${w.leaderRankAll}`);
  if (w.totalPnl > 1_000_000) b.push("Top 1% PnL");
  if (w.totalVolume > 100_000) b.push("Whale (>100k)");
  if (w.winRate >= 75) b.push("High Win Rate");
  if (w.makerSharePct >= 60) b.push("Maker-Heavy");
  if (w.profitFactor !== null && w.profitFactor >= 2) b.push("Profit Factor 2x+");
  if (w.concentrationPct !== null && w.concentrationPct >= 60) b.push("Concentrated");
  if (w.observedBehavior) b.push(w.observedBehavior);
  return b.length ? b : ["Tracked Wallet"];
}

/**
 * The Edge Audit returns SUMMARY objects, not per-position rows. We surface the
 * real aggregates as two synthetic "summary positions" (open + closed) so the
 * drawer has honest content, and gate a locked "active positions" row that
 * genuinely requires the paid Trade Monitor / Pro feed — no fabricated trades.
 */
function summaryPositions(w: ApiWhale, category: WhaleCategory): WhalePosition[] {
  const now = new Date().toISOString();
  const positions: WhalePosition[] = [];

  // Visible: open positions aggregate.
  positions.push({
    id: `${w.address}-open`,
    marketTitle: `Open positions · ${w.activePositionsCount} market${w.activePositionsCount === 1 ? "" : "s"}`,
    outcome: "YES",
    shares: 0,
    avgPrice: 0,
    currentPrice: 0,
    pnl: w.openValueUsdc,
    pnlPercent: 0,
    totalCost: w.openValueUsdc,
    category,
    timestamp: now,
    isLocked: false,
  });

  // Visible: closed realized PnL aggregate.
  positions.push({
    id: `${w.address}-closed`,
    marketTitle: `Closed realized PnL · ${w.wins}W-${w.losses}L`,
    outcome: w.totalPnl >= 0 ? "YES" : "NO",
    shares: 0,
    avgPrice: 0,
    currentPrice: 0,
    pnl: w.totalPnl,
    pnlPercent: 0,
    totalCost: w.totalVolume,
    category,
    timestamp: now,
    isLocked: false,
  });

  // Locked: real-time active orders require the paid feed.
  positions.push({
    id: `${w.address}-live1`,
    marketTitle: "Live order flow (real-time)",
    outcome: "YES",
    shares: 0,
    avgPrice: 0.5,
    currentPrice: 0.5,
    pnl: 0,
    pnlPercent: 0,
    totalCost: w.openValueUsdc / Math.max(w.activePositionsCount, 1),
    category,
    timestamp: now,
    isLocked: true,
  });
  positions.push({
    id: `${w.address}-live2`,
    marketTitle: "Next whale fill (Pro alert)",
    outcome: "NO",
    shares: 0,
    avgPrice: 0.5,
    currentPrice: 0.5,
    pnl: 0,
    pnlPercent: 0,
    totalCost: w.openValueUsdc / Math.max(w.activePositionsCount, 1),
    category,
    timestamp: now,
    isLocked: true,
  });

  return positions;
}

function relativeFrom(iso: string): string {
  if (!iso) return "recently";
  const t = Date.parse(iso);
  if (Number.isNaN(t)) return "recently";
  const mins = Math.max(0, Math.round((Date.now() - t) / 60000));
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.round(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.round(hrs / 24)}d ago`;
}

function adapt(list: ApiWhale[]): WhaleTrader[] {
  const ranked = [...list].sort((a, b) => b.totalPnl - a.totalPnl);
  return ranked.map((w, i) => {
    const category = categoryFor(w.address);
    const positions = summaryPositions(w, category);
    return {
      id: w.address || `w${i}`,
      rank: i + 1,
      address: w.address,
      totalPnl: w.totalPnl,
      pnl30d: w.pnl30d,
      pnl7d: w.pnl7d,
      winRate: w.winRate,
      wins: w.wins,
      losses: w.losses,
      totalVolume: w.totalVolume,
      activePositionsCount: w.activePositionsCount,
      category,
      badges: badgesFor(w),
      lastActive: relativeFrom(w.scannedAt),
      currentTopBet: {
        marketTitle:
          w.activePositionsCount > 0
            ? `${w.activePositionsCount} open position${w.activePositionsCount === 1 ? "" : "s"}`
            : "No open positions",
        outcome: w.totalPnl >= 0 ? ("YES" as Outcome) : ("NO" as Outcome),
        amount: w.openValueUsdc,
      },
      positions,
    };
  });
}

export function useWhaleData(): { whales: WhaleTrader[]; source: DataSource } {
  const [whales, setWhales] = useState<WhaleTrader[]>(mockWhales);
  const [source, setSource] = useState<DataSource>("loading");

  useEffect(() => {
    let cancelled = false;
    fetch("/api/whales")
      .then((r) => (r.ok ? (r.json() as Promise<ApiResponse>) : Promise.reject(new Error("bad status"))))
      .then((data) => {
        if (cancelled) return;
        if (data.ok && data.whales.length > 0) {
          setWhales(adapt(data.whales));
          setSource("live");
        } else {
          setWhales(mockWhales);
          setSource("demo");
        }
      })
      .catch(() => {
        if (cancelled) return;
        setWhales(mockWhales);
        setSource("demo");
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return { whales, source };
}
