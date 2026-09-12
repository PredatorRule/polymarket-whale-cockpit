// src/components/RecentMoves.tsx
import { Zap } from "lucide-react";
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

export function RecentMoves({ moves }: { moves: RecentMove[] }) {
  if (moves.length === 0) return null;

  return (
    <div className="rounded-xl border border-zinc-800 bg-surface shadow-lg shadow-black/20">
      <div className="flex items-center gap-2 border-b border-zinc-800 px-4 py-3">
        <Zap className="h-4 w-4 text-cyan-300" aria-hidden="true" />
        <h2 className="text-sm font-semibold text-zinc-100">Live Whale Movements</h2>
        <span className="ml-auto inline-flex items-center gap-1.5 font-mono text-[11px] text-emerald-400">
          <span className="inline-flex h-1.5 w-1.5 rounded-full bg-emerald-400 animate-beacon" />
          live
        </span>
      </div>
      <div className="max-h-72 overflow-y-auto scroll-thin divide-y divide-zinc-800/60">
        {moves.map((m, i) => {
          const buy = m.action.startsWith("BOUGHT");
          return (
            <a
              key={`${m.wallet}-${m.timestamp}-${i}`}
              href={m.eventUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-3 px-4 py-2.5 transition-colors hover:bg-zinc-800/40"
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
      </div>
    </div>
  );
}
