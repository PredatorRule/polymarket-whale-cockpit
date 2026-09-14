// src/data/useWhaleData.ts
// Loads whale data from the /api/whales Pages Function (live Polymarket public
// leaderboard + positions). Real data only — no mock is ever displayed.
import { useEffect, useState } from "react";
import type { WhaleTrader, WhaleCategory, Outcome, WhalePosition } from "../types/whale";
import { classifyTitles } from "../lib/classify";

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
  lastTradeTs: number;
}

interface ApiResponse {
  ok: boolean;
  reason: string;
  whales: ApiWhale[];
}

interface MovesResponse {
  ok: boolean;
  moves: RecentMove[];
  isPro?: boolean;
  delayedCount?: number;
  delaySeconds?: number;
}

/** Classify from real position titles; unmatched titles are honestly "Other". */
function classify(w: ApiWhale): WhaleCategory {
  return classifyTitles(w.positions.map((p) => p.marketTitle));
}

/**
 * Differentiating badges: only surface signals that actually vary across the
 * board, so a badge means something at a glance instead of every row sharing
 * the same generic tags.
 */
function badgesFor(w: ApiWhale): string[] {
  const b: string[] = [];
  const nowSec = Date.now() / 1000;

  // Freshness — the single most useful "should I care right now" signal.
  if (w.lastTradeTs > 0) {
    const ageMin = (nowSec - w.lastTradeTs) / 60;
    if (ageMin <= 60) b.push("🔥 Hot");
    else if (ageMin <= 60 * 24) b.push("Active today");
    else if (ageMin > 60 * 24 * 14) b.push("💤 Dormant");
  }

  // Sharpness vs degen — win rate + sample size.
  const closed = w.wins + w.losses;
  if (w.winRate >= 65 && closed >= 20) b.push("🎯 Sharp");
  else if (w.winRate > 0 && w.winRate < 40 && closed >= 20) b.push("🎲 Coinflip");

  // Currently exposed vs flat.
  if (w.activePositionsCount === 0) b.push("Flat");
  else if (w.openValueUsdc >= 250_000) b.push("Heavy exposure");

  // Recent momentum vs all-time (rising star).
  if (w.pnl7d > 0 && w.totalPnl > 0 && w.pnl7d >= w.totalPnl * 0.25) b.push("📈 Surging");

  // In the red.
  if (w.totalPnl < 0) b.push("📉 Underwater");

  return b.length ? b : ["Tracked"];
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

function adaptOne(w: ApiWhale, rank: number): WhaleTrader {
  const category = classify(w);
  const positions = mapPositions(w, category);
  const top = w.topBet;
  return {
    id: w.address || `w${rank}`,
    rank,
    address: w.address,
    ensName: w.name,
    totalPnl: w.totalPnl,
    pnl30d: w.pnl30d,
    pnl7d: w.pnl7d,
    winRate: w.winRate,
    wins: w.wins,
    losses: w.losses,
    totalVolume: w.totalVolume,
    maxDrawdownUsdc: w.maxDrawdownUsdc ?? 0,
    activePositionsCount: w.activePositionsCount,
    category,
    badges: badgesFor(w),
    lastActive: "live",
    lastTradeTs: w.lastTradeTs ?? 0,
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
}

function adapt(list: ApiWhale[]): WhaleTrader[] {
  const ranked = [...list].sort((a, b) => b.totalPnl - a.totalPnl);
  return ranked.map((w, i) => adaptOne(w, i + 1));
}

/** Look up any public wallet on demand via /api/wallet. */
export async function lookupWallet(address: string): Promise<WhaleTrader | null> {
  const addr = address.trim().toLowerCase();
  if (!/^0x[0-9a-f]{40}$/.test(addr)) return null;
  try {
    const r = await fetch(`/api/wallet?address=${addr}`, { cache: "no-store" });
    if (!r.ok) return null;
    const data = (await r.json()) as { ok: boolean; whale: ApiWhale | null };
    if (!data.ok || !data.whale) return null;
    const t = adaptOne(data.whale, 0);
    t.badges = ["Custom lookup", ...t.badges.filter((b) => !b.startsWith("Leaderboard"))];
    return t;
  } catch {
    return null;
  }
}

// Auto-refresh interval (ms). The API is edge-cached, so frequent polls are
// cheap and mostly hit cache; 60s keeps the board feeling live without spam.
const REFRESH_MS = 60_000;

export function useWhaleData(accessToken: string | null | undefined): {
  whales: WhaleTrader[];
  recentMoves: RecentMove[];
  serverDelayedCount: number;
  source: DataSource;
  lastUpdated: number | null;
  trackedCount: number;
} {
  const [whales, setWhales] = useState<WhaleTrader[]>([]);
  const [recentMoves, setRecentMoves] = useState<RecentMove[]>([]);
  const [serverDelayedCount, setServerDelayedCount] = useState(0);
  const [source, setSource] = useState<DataSource>("loading");
  const [lastUpdated, setLastUpdated] = useState<number | null>(null);

  useEffect(() => {
    let cancelled = false;

    // Only /api/moves is plan-aware, so only it needs the bearer token.
    const authHeaders: HeadersInit = accessToken
      ? { authorization: `Bearer ${accessToken}` }
      : {};

    const load = async () => {
      // Leaderboard and the live moves feed are separate endpoints so each has
      // its own subrequest budget; fetch them independently.
      try {
        const r = await fetch("/api/whales", { cache: "no-store" });
        if (!r.ok) throw new Error("bad status");
        const data = (await r.json()) as ApiResponse;
        if (cancelled) return;
        if (data.ok && data.whales.length > 0) {
          setWhales(adapt(data.whales));
          setSource("live");
          setLastUpdated(Date.now());
        } else if (source === "loading") {
          setSource("error");
        }
      } catch {
        if (cancelled) return;
        if (source === "loading") setSource("error");
      }

      // Moves are best-effort; a failure here never breaks the leaderboard.
      // The server enforces the free-tier delay, so the client just renders
      // whatever it's given plus the count of moves withheld server-side.
      try {
        const mr = await fetch("/api/moves", { cache: "no-store", headers: authHeaders });
        if (mr.ok) {
          const md = (await mr.json()) as MovesResponse;
          if (!cancelled && md.ok) {
            setRecentMoves(md.moves ?? []);
            setServerDelayedCount(md.delayedCount ?? 0);
          }
        }
      } catch {
        /* keep last good moves */
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
  }, [accessToken]);

  return {
    whales,
    recentMoves,
    serverDelayedCount,
    source,
    lastUpdated,
    trackedCount: whales.length,
  };
}
