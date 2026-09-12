// src/data/useWhaleData.ts
// Loads whale data from the /api/whales Pages Function (live Apify audit data)
// and falls back to bundled mock data when the API is unconfigured or empty.
import { useEffect, useState } from "react";
import type { WhaleTrader, WhaleCategory, Outcome, WhalePosition } from "../types/whale";
import { mockWhales } from "./mockWhales";

export type DataSource = "live" | "demo" | "loading";

interface ApiWhale {
  address: string;
  ensName?: string;
  totalPnl: number;
  pnl30d: number;
  pnl7d: number;
  winRate: number;
  wins: number;
  losses: number;
  totalVolume: number;
  activePositionsCount: number;
  _raw?: Record<string, unknown>;
}

interface ApiResponse {
  ok: boolean;
  reason: string;
  whales: ApiWhale[];
}

const CATEGORIES: WhaleCategory[] = ["Politics", "Macro", "Crypto", "Pop Culture"];

/** Deterministic category pick so the same wallet always maps the same way. */
function categoryFor(address: string): WhaleCategory {
  let h = 0;
  for (let i = 0; i < address.length; i++) h = (h * 31 + address.charCodeAt(i)) >>> 0;
  return CATEGORIES[h % CATEGORIES.length];
}

function badgesFor(w: ApiWhale): string[] {
  const b: string[] = [];
  if (w.totalPnl > 1_000_000) b.push("Top 1% PnL");
  if (w.totalVolume > 100_000) b.push("Whale (>100k)");
  if (w.winRate >= 75) b.push("High Win Rate");
  if (w.totalVolume > 8_000_000) b.push("High Volume");
  return b.length ? b : ["Tracked Wallet"];
}

/**
 * The Edge Audit record is a summary, not a per-position feed with locked/
 * visible splits. We surface the real summary metrics and, when the raw record
 * carries position rows, map them; otherwise we present the summary only with
 * no fabricated positions. This keeps the UI honest: real numbers, and the
 * locked-alpha section simply shows "no data" rather than invented trades.
 */
function mapPositions(raw: Record<string, unknown> | undefined, category: WhaleCategory): WhalePosition[] {
  const rows =
    raw && Array.isArray((raw as Record<string, unknown>).positions)
      ? ((raw as Record<string, unknown>).positions as Record<string, unknown>[])
      : [];
  return rows.slice(0, 4).map((p, i) => {
    const avgPrice = Number(p.avgPrice ?? p.avg_price ?? p.price ?? 0.5) || 0.5;
    const currentPrice = Number(p.currentPrice ?? p.current_price ?? avgPrice) || avgPrice;
    const shares = Number(p.shares ?? p.size ?? 0) || 0;
    const totalCost = shares * avgPrice;
    const pnl = shares * (currentPrice - avgPrice);
    return {
      id: `pos-${i}`,
      marketTitle: String(p.marketTitle ?? p.market ?? p.title ?? "Position"),
      outcome: (String(p.outcome ?? "YES").toUpperCase() === "NO" ? "NO" : "YES") as Outcome,
      shares,
      avgPrice,
      currentPrice,
      pnl,
      pnlPercent: avgPrice > 0 ? ((currentPrice - avgPrice) / avgPrice) * 100 : 0,
      totalCost,
      category,
      timestamp: new Date().toISOString(),
      isLocked: i >= 2, // first two visible, rest gated
    };
  });
}

function adapt(list: ApiWhale[]): WhaleTrader[] {
  const ranked = [...list].sort((a, b) => b.totalPnl - a.totalPnl);
  return ranked.map((w, i) => {
    const category = categoryFor(w.address);
    const positions = mapPositions(w._raw, category);
    const topBet = positions.find((p) => !p.isLocked) ?? positions[0];
    return {
      id: w.address || `w${i}`,
      rank: i + 1,
      address: w.address,
      ensName: w.ensName,
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
      lastActive: "recently",
      currentTopBet: topBet
        ? { marketTitle: topBet.marketTitle, outcome: topBet.outcome, amount: topBet.totalCost }
        : { marketTitle: "No active position", outcome: "YES", amount: 0 },
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
