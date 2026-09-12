// src/data/useWhaleData.ts
// Loads whale data from the /api/whales Pages Function (live Polymarket public
// leaderboard + positions). Real data only — no mock is ever displayed.
import { useEffect, useState } from "react";
import type { WhaleTrader, WhaleCategory, Outcome, WhalePosition } from "../types/whale";

export type DataSource = "live" | "error" | "loading";

interface ApiPosition {
  marketTitle: string;
  outcome: "YES" | "NO";
  shares: number;
  avgPrice: number;
  currentPrice: number;
  pnl: number;
  pnlPercent: number;
  totalCost: number;
}

// Matches NormalizedWhale in functions/api/whales.ts
interface ApiWhale {
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

interface ApiResponse {
  ok: boolean;
  reason: string;
  whales: ApiWhale[];
}

const CATEGORIES: WhaleCategory[] = ["Politics", "Macro", "Crypto", "Pop Culture"];

// Keyword → category classification from the real market titles.
const CATEGORY_KEYWORDS: { category: WhaleCategory; words: string[] }[] = [
  { category: "Crypto", words: ["btc", "bitcoin", "eth", "ethereum", "sol", "crypto", "coin", "token", "xrp", "doge"] },
  { category: "Politics", words: ["president", "election", "senate", "congress", "trump", "biden", "governor", "poll", "vote", "shutdown", "speaker", "cabinet"] },
  { category: "Macro", words: ["fed", "rate", "cpi", "inflation", "recession", "gdp", "unemployment", "jobs", "yield", "oil", "gold", "ecb"] },
  { category: "Pop Culture", words: ["movie", "oscar", "album", "box office", "grammy", "show", "celebrity", "award", "streaming"] },
];

/** Classify from real position titles; fallback deterministic by address. */
function classify(w: ApiWhale): WhaleCategory {
  const hay = w.positions.map((p) => p.marketTitle.toLowerCase()).join(" ");
  for (const { category, words } of CATEGORY_KEYWORDS) {
    if (words.some((word) => hay.includes(word))) return category;
  }
  let h = 0;
  for (let i = 0; i < w.address.length; i++) h = (h * 31 + w.address.charCodeAt(i)) >>> 0;
  return CATEGORIES[h % CATEGORIES.length];
}

/** Badges from REAL leaderboard + closed-position metrics. */
function badgesFor(w: ApiWhale): string[] {
  const b: string[] = [];
  if (w.leaderRankAll > 0 && w.leaderRankAll <= 100) b.push(`Leaderboard #${w.leaderRankAll}`);
  if (w.totalPnl > 1_000_000) b.push("Top 1% PnL");
  if (w.totalVolume > 100_000) b.push("Whale (>100k)");
  if (w.winRate >= 75) b.push("High Win Rate");
  if (w.activePositionsCount >= 10) b.push("High Activity");
  return b.length ? b : ["Tracked Wallet"];
}

/**
 * Real positions become the drawer rows. First two are shown in full; any
 * beyond that are gated as "locked alpha" so the free tier shows genuine data
 * while the paid real-time feed remains the upsell.
 */
function mapPositions(w: ApiWhale, category: WhaleCategory): WhalePosition[] {
  const now = new Date().toISOString();
  return w.positions.slice(0, 4).map((p, i) => ({
    id: `${w.address}-${i}`,
    marketTitle: p.marketTitle,
    outcome: p.outcome as Outcome,
    shares: p.shares,
    avgPrice: p.avgPrice,
    currentPrice: p.currentPrice,
    pnl: p.pnl,
    pnlPercent: p.pnlPercent,
    totalCost: p.totalCost,
    category,
    timestamp: now,
    isLocked: i >= 2,
  }));
}

function adapt(list: ApiWhale[]): WhaleTrader[] {
  const ranked = [...list].sort((a, b) => b.totalPnl - a.totalPnl);
  return ranked.map((w, i) => {
    const category = classify(w);
    const positions = mapPositions(w, category);
    const top = w.topBet;
    return {
      id: w.address || `w${i}`,
      rank: i + 1,
      address: w.address,
      ensName: w.name,
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
      lastActive: "live",
      currentTopBet: top
        ? {
            marketTitle: top.marketTitle,
            outcome: top.outcome as Outcome,
            amount: top.currentPrice * top.shares,
          }
        : {
            marketTitle: w.activePositionsCount > 0 ? "Open positions" : "No open positions",
            outcome: w.totalPnl >= 0 ? "YES" : "NO",
            amount: w.openValueUsdc,
          },
      positions,
    };
  });
}

export function useWhaleData(): { whales: WhaleTrader[]; source: DataSource } {
  const [whales, setWhales] = useState<WhaleTrader[]>([]);
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
          setWhales([]);
          setSource("error");
        }
      })
      .catch(() => {
        if (cancelled) return;
        setWhales([]);
        setSource("error");
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return { whales, source };
}
