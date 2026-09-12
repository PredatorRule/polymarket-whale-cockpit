// src/data/useWhaleData.ts
// Loads whale data from the /api/whales Pages Function (live Polymarket public
// leaderboard + positions). Real data only — no mock is ever displayed.
import { useEffect, useState } from "react";
import type { WhaleTrader, WhaleCategory, Outcome, WhalePosition } from "../types/whale";

export type DataSource = "live" | "error" | "loading";

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
  recentMoves?: RecentMove[];
}

// Keyword → category classification from the real market titles. Order matters:
// the first matching category wins, so Sports (very common on Polymarket) and
// Crypto are checked before the broader buckets.
const CATEGORY_KEYWORDS: { category: WhaleCategory; words: string[] }[] = [
  { category: "Crypto", words: ["btc", "bitcoin", "eth", "ethereum", "sol", "solana", "crypto", "coin", "token", "xrp", "doge", "nft"] },
  { category: "Sports", words: [
    "fc", "cf", "united", "city", "vs", "win on", "match", "cup", "league",
    "nba", "nfl", "mlb", "nhl", "ufc", "premier", "la liga", "serie a",
    "champions", "playoff", "super bowl", "world cup", "tennis", "atp", "wta",
    "soccer", "football", "basketball", "baseball", "hockey", "score",
    "whitecaps", "grand prix", "f1", "formula",
  ] },
  { category: "Politics", words: ["president", "election", "senate", "congress", "trump", "biden", "governor", "poll", "vote", "shutdown", "speaker", "cabinet", "primary", "nominee"] },
  { category: "Macro", words: ["fed", "rate", "cpi", "inflation", "recession", "gdp", "unemployment", "jobs", "yield", "oil", "gold", "ecb", "interest"] },
  { category: "Pop Culture", words: ["movie", "oscar", "album", "box office", "grammy", "show", "celebrity", "award", "streaming", "spotify", "netflix"] },
];

/** Classify from real position titles; unmatched titles are honestly "Other". */
function classify(w: ApiWhale): WhaleCategory {
  const hay = w.positions.map((p) => p.marketTitle.toLowerCase()).join(" ");
  for (const { category, words } of CATEGORY_KEYWORDS) {
    if (words.some((word) => hay.includes(word))) return category;
  }
  return "Other";
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

// Auto-refresh interval (ms). The API is edge-cached, so frequent polls are
// cheap and mostly hit cache; 60s keeps the board feeling live without spam.
const REFRESH_MS = 60_000;

export function useWhaleData(): {
  whales: WhaleTrader[];
  recentMoves: RecentMove[];
  source: DataSource;
  lastUpdated: number | null;
} {
  const [whales, setWhales] = useState<WhaleTrader[]>([]);
  const [recentMoves, setRecentMoves] = useState<RecentMove[]>([]);
  const [source, setSource] = useState<DataSource>("loading");
  const [lastUpdated, setLastUpdated] = useState<number | null>(null);

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      try {
        const r = await fetch("/api/whales", { cache: "no-store" });
        if (!r.ok) throw new Error("bad status");
        const data = (await r.json()) as ApiResponse;
        if (cancelled) return;
        if (data.ok && data.whales.length > 0) {
          setWhales(adapt(data.whales));
          setRecentMoves(data.recentMoves ?? []);
          setSource("live");
          setLastUpdated(Date.now());
        } else if (source === "loading") {
          // Only surface an error if we have nothing to show yet; otherwise
          // keep the last good data on a transient failure.
          setSource("error");
        }
      } catch {
        if (cancelled) return;
        if (source === "loading") setSource("error");
      }
    };

    void load();
    const id = setInterval(load, REFRESH_MS);

    // Refresh immediately when the tab regains focus.
    const onVisible = () => {
      if (document.visibilityState === "visible") void load();
    };
    document.addEventListener("visibilitychange", onVisible);

    return () => {
      cancelled = true;
      clearInterval(id);
      document.removeEventListener("visibilitychange", onVisible);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return { whales, recentMoves, source, lastUpdated };
}
