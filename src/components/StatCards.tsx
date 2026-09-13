// src/components/StatCards.tsx
import { TrendingUp, Zap, Layers, Target } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import type { WhaleTrader } from "../types/whale";
import type { RecentMove } from "../data/useWhaleData";
import { formatSignedUsd, formatCompactUsd, formatPercent } from "../lib/format";
import { OutcomePill } from "./Badge";

interface Kpi {
  label: string;
  value: string;
  valueClass: string;
  icon: LucideIcon;
  sub: string;
  outcome?: "YES" | "NO";
}

export function StatCards({
  whales,
  moves,
}: {
  whales: WhaleTrader[];
  moves: RecentMove[];
}) {
  // Guard: the filtered set can be empty (e.g. a search with no matches).
  if (whales.length === 0) return null;

  // 1. Combined PnL across the shown wallets — a real aggregate.
  const combinedPnl = whales.reduce((sum, w) => sum + w.totalPnl, 0);

  // 2. Biggest LIVE move from the real trades feed (ties the header to activity).
  const biggestMove =
    moves.length > 0
      ? moves.reduce((best, m) => (m.notionalUsd > best.notionalUsd ? m : best))
      : null;

  // 3. Largest active stake across the shown wallets — real open position.
  const largestBet = whales.reduce(
    (best, w) => (w.currentTopBet.amount > best.currentTopBet.amount ? w : best),
    whales[0],
  );

  // 4. Average win rate across the shown wallets — real.
  const avgWinRate =
    whales.reduce((sum, w) => sum + w.winRate, 0) / whales.length;

  const kpis: Kpi[] = [
    {
      label: "Combined Tracked PnL",
      value: formatSignedUsd(combinedPnl),
      valueClass: combinedPnl >= 0 ? "text-emerald-400" : "text-rose-400",
      icon: TrendingUp,
      sub: `across ${whales.length} wallet${whales.length === 1 ? "" : "s"}`,
    },
    biggestMove
      ? {
          label: "Biggest Live Move",
          value: formatCompactUsd(biggestMove.notionalUsd),
          valueClass: "text-cyan-300",
          icon: Zap,
          sub: biggestMove.title,
          outcome: biggestMove.outcome,
        }
      : {
          label: "Live Moves",
          value: `${moves.length}`,
          valueClass: "text-cyan-300",
          icon: Zap,
          sub: "large trades in feed",
        },
    {
      label: "Largest Active Stake",
      value: formatCompactUsd(largestBet.currentTopBet.amount),
      valueClass: "text-amber-400",
      icon: Layers,
      sub: largestBet.currentTopBet.marketTitle,
      outcome: largestBet.currentTopBet.outcome,
    },
    {
      label: "Avg Win Rate (shown)",
      value: formatPercent(avgWinRate),
      valueClass: "text-emerald-400",
      icon: Target,
      sub: `${whales.length} wallet${whales.length === 1 ? "" : "s"} in view`,
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
            <k.icon className={`h-4 w-4 ${k.valueClass}`} aria-hidden="true" />
          </div>
          <div className={`mt-2 font-mono text-2xl font-bold tabular-nums ${k.valueClass}`}>
            {k.value}
          </div>
          <div className="mt-1 flex items-center gap-1.5">
            {k.outcome && <OutcomePill outcome={k.outcome} />}
            <span className="truncate text-xs text-zinc-500" title={k.sub}>
              {k.sub}
            </span>
          </div>
        </div>
      ))}
    </div>
  );
}
