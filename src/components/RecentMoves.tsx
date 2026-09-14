// src/components/RecentMoves.tsx
import { useEffect, useRef, useState } from "react";
import { Zap, Lock } from "lucide-react";
import type { RecentMove } from "../data/useWhaleData";
import { formatCompactUsd, truncateAddress } from "../lib/format";
import { OutcomePill } from "./Badge";

function ago(ts: number): string {
  const secs = Math.max(0, Math.floor(Date.now() / 1000 - ts));
  if (secs < 60) return `${secs}s ago`;
  const mins = Math.floor(secs / 60);
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  return `${hrs}h ago`;
}

/** Stable identity for a move row. */
function moveKey(m: RecentMove): string {
  return `${m.wallet}-${m.timestamp}-${m.title}-${m.notionalUsd}`;
}

export function RecentMoves({
  moves,
  delayedCount = 0,
  isPro = false,
  onUpgrade,
}: {
  moves: RecentMove[];
  delayedCount?: number;
  isPro?: boolean;
  onUpgrade?: () => void;
}) {
  // Track which move keys we've already rendered so newly arrived ones flash.
  const seenRef = useRef<Set<string> | null>(null);
  const [freshKeys, setFreshKeys] = useState<Set<string>>(new Set());

  useEffect(() => {
    // Wait for the first non-empty payload before seeding the baseline, so the
    // initial data load doesn't count as "all new" and flash every row.
    if (moves.length === 0) return;

    const current = new Set(moves.map(moveKey));
    if (seenRef.current === null) {
      // First real load: seed the baseline, flash nothing.
      seenRef.current = current;
      return;
    }
    const fresh = new Set<string>();
    for (const k of current) if (!seenRef.current.has(k)) fresh.add(k);
    seenRef.current = current;
    if (fresh.size > 0) {
      setFreshKeys(fresh);
      const t = setTimeout(() => setFreshKeys(new Set()), 2400);
      return () => clearTimeout(t);
    }
  }, [moves]);

  if (moves.length === 0 && delayedCount === 0) return null;

  return (
    <div className="rounded-xl border border-zinc-800 bg-surface shadow-lg shadow-black/20">
      <div className="flex items-center gap-2 border-b border-zinc-800 px-4 py-3">
        <Zap className="h-4 w-4 text-cyan-300" aria-hidden="true" />
        <h2 className="text-sm font-semibold text-zinc-100">Live Whale Movements</h2>
        {isPro ? (
          <span className="ml-auto inline-flex items-center gap-1.5 font-mono text-[11px] text-emerald-400">
            <span className="inline-flex h-1.5 w-1.5 rounded-full bg-emerald-400 animate-beacon" />
            real-time
          </span>
        ) : (
          <button
            type="button"
            onClick={onUpgrade}
            className="ml-auto inline-flex items-center gap-1.5 rounded-full border border-amber-500/40 bg-amber-500/10 px-2 py-0.5 font-mono text-[11px] text-amber-400 transition-colors hover:bg-amber-500/20"
            title="Free tier is delayed 10 minutes — upgrade for the real-time stream"
          >
            <Lock className="h-3 w-3" aria-hidden="true" />
            10-min delay · Upgrade
          </button>
        )}
      </div>

      {!isPro && delayedCount > 0 && (
        <button
          type="button"
          onClick={onUpgrade}
          className="flex w-full items-center justify-center gap-2 border-b border-zinc-800/60 bg-amber-500/5 px-4 py-2 text-xs text-amber-300/90 transition-colors hover:bg-amber-500/10"
        >
          <Lock className="h-3 w-3" aria-hidden="true" />
          {delayedCount} newer {delayedCount === 1 ? "move is" : "moves are"} hidden on the free tier — unlock the real-time feed (€9/mo)
        </button>
      )}
      <div className="max-h-72 divide-y divide-zinc-800/60 overflow-y-auto scroll-thin">
        {moves.map((m) => {
          const key = moveKey(m);
          const buy = m.action.startsWith("BOUGHT");
          const isFresh = freshKeys.has(key);
          return (
            <a
              key={key}
              href={m.eventUrl}
              target="_blank"
              rel="noopener noreferrer"
              className={`flex items-center gap-3 px-4 py-2.5 transition-colors hover:bg-zinc-800/40 ${
                isFresh ? "animate-flash-new" : ""
              }`}
            >
              <span
                className={`shrink-0 font-mono text-xs font-semibold ${buy ? "text-emerald-400" : "text-rose-400"}`}
              >
                {m.action}
              </span>
              <OutcomePill outcome={m.outcome} />
              <span className="min-w-0 flex-1 truncate text-sm text-zinc-300" title={m.title}>
                {m.title}
              </span>
              <span className="shrink-0 font-mono text-sm font-semibold tabular-nums text-zinc-100">
                {formatCompactUsd(m.notionalUsd)}
              </span>
              <span className="hidden shrink-0 font-mono text-[11px] text-zinc-500 sm:inline">
                {m.name ? m.name : truncateAddress(m.wallet)}
              </span>
              <span className="shrink-0 font-mono text-[11px] text-zinc-600">{ago(m.timestamp)}</span>
            </a>
          );
        })}
        {moves.length === 0 && (
          <div className="px-4 py-8 text-center text-xs text-zinc-500">
            No older moves to show yet. {!isPro && "Newer trades are on the real-time (Pro) feed."}
          </div>
        )}
      </div>
    </div>
  );
}
