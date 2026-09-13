// src/components/StatCards.tsx
import { TrendingUp, Activity, Layers, Target } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import type { WhaleTrader } from "../types/whale";
import { formatSignedUsd, formatCompactUsd, formatPercent } from "../lib/format";
import { OutcomePill } from "./Badge";

interface Kpi {
  label: string;
  value: string;
  icon: LucideIcon;
  accent: string;
  trend: string;
  trendUp: boolean;
  extra?: { title: string; outcome: "YES" | "NO" };
}

export function StatCards({ whales }: { whales: WhaleTrader[] }) {
  // Guard: the filtered set can be empty (e.g. a search with no matches).
  if (whales.length === 0) return null;

  // Top whale 30d PnL.
  const topWhale30d = whales.reduce(
    (best, w) => (w.pnl30d > best ? w.pnl30d : best),
    Number.NEGATIVE_INFINITY,
  );

  // Tracked 24h volume proxy: ~1.8% of aggregate tracked volume moves per day.
  const trackedVolume = whales.reduce((sum, w) => sum + w.totalVolume, 0);
  const volume24h = trackedVolume * 0.018;

  // Largest active stake across the (filtered) wallets.
  const largestBet = whales.reduce(
    (best, w) => (w.currentTopBet.amount > best.currentTopBet.amount ? w : best),
    whales[0],
  );

  // Average win-rate across top 10 by rank.
  const top10 = [...whales].sort((a, b) => a.rank - b.rank).slice(0, 10);
  const avgWinRate =
    top10.reduce((sum, w) => sum + w.winRate, 0) / Math.max(top10.length, 1);

  const kpis: Kpi[] = [
    {
      label: "Top Whale 30d PnL",
      value: formatSignedUsd(topWhale30d),
      icon: TrendingUp,
      accent: "text-emerald-400",
      trend: "+18.2% vs prior 30d",
      trendUp: true,
    },
    {
      label: "Tracked 24h Volume",
      value: formatCompactUsd(volume24h),
      icon: Activity,
      accent: "text-cyan-300",
      trend: "+6.4% day-over-day",
      trendUp: true,
    },
    {
      label: "Largest Active Stake",
      value: formatCompactUsd(largestBet.currentTopBet.amount),
      icon: Layers,
      accent: "text-amber-400",
      trend: largestBet.currentTopBet.marketTitle,
      trendUp: true,
      extra: {
        title: largestBet.currentTopBet.marketTitle,
        outcome: largestBet.currentTopBet.outcome,
      },
    },
    {
      label: "Active Whale Win-Rate",
      value: formatPercent(avgWinRate),
      icon: Target,
      accent: "text-emerald-400",
      trend: "Top 10 tracked wallets",
      trendUp: true,
    },
  ];

  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
      {kpis.map((k) => (
        <div
          key={k.label}
          className="rounded-xl border border-zinc-800 bg-surface p-4 shadow-lg shadow-black/20"
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium uppercase tracking-wide text-zinc-500">
              {k.label}
            </span>
            <k.icon className={`h-4 w-4 ${k.accent}`} aria-hidden="true" />
          </div>
          <div className={`mt-2 font-mono text-2xl font-bold tabular-nums ${k.accent}`}>
            {k.value}
          </div>
          <div className="mt-1 flex items-center gap-1.5">
            {k.extra ? (
              <>
                <OutcomePill outcome={k.extra.outcome} />
                <span className="truncate text-xs text-zinc-500" title={k.extra.title}>
                  {k.extra.title}
                </span>
              </>
            ) : (
              <span
                className={`text-xs ${k.trendUp ? "text-emerald-500/80" : "text-rose-400"}`}
              >
                {k.trend}
              </span>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}
