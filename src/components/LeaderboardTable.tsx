// src/components/LeaderboardTable.tsx
import { useState } from "react";
import {
  Crown,
  Medal,
  Copy,
  Check,
  ExternalLink,
  ArrowUp,
  ArrowDown,
  ChevronsUpDown,
} from "lucide-react";
import type { WhaleTrader, SortKey, SortState } from "../types/whale";
import {
  formatSignedUsd,
  formatCompactUsd,
  formatPercent,
  truncateAddress,
  pnlColor,
} from "../lib/format";
import { Badge, OutcomePill, toneForBadge } from "./Badge";

interface Props {
  whales: WhaleTrader[];
  sort: SortState;
  onSort: (key: SortKey) => void;
  onSelect: (whale: WhaleTrader) => void;
  selectedId?: string;
}

function RankCell({ rank }: { rank: number }) {
  if (rank === 1)
    return (
      <span className="inline-flex items-center gap-1 font-mono font-bold text-amber-400">
        <Crown className="h-4 w-4 fill-amber-400/20" aria-hidden="true" />1
      </span>
    );
  if (rank === 2)
    return (
      <span className="inline-flex items-center gap-1 font-mono font-bold text-zinc-300">
        <Medal className="h-4 w-4" aria-hidden="true" />2
      </span>
    );
  if (rank === 3)
    return (
      <span className="inline-flex items-center gap-1 font-mono font-bold text-amber-700">
        <Medal className="h-4 w-4" aria-hidden="true" />3
      </span>
    );
  return <span className="font-mono text-zinc-500">{rank}</span>;
}

function SortHeader({
  label,
  column,
  sort,
  onSort,
  align = "left",
}: {
  label: string;
  column: SortKey;
  sort: SortState;
  onSort: (k: SortKey) => void;
  align?: "left" | "right";
}) {
  const active = sort.key === column;
  return (
    <button
      onClick={() => onSort(column)}
      className={`inline-flex items-center gap-1 text-xs font-semibold uppercase tracking-wide transition-colors hover:text-zinc-200 ${
        active ? "text-zinc-200" : "text-zinc-500"
      } ${align === "right" ? "flex-row-reverse" : ""}`}
    >
      {label}
      {active ? (
        sort.direction === "asc" ? (
          <ArrowUp className="h-3 w-3" aria-hidden="true" />
        ) : (
          <ArrowDown className="h-3 w-3" aria-hidden="true" />
        )
      ) : (
        <ChevronsUpDown className="h-3 w-3 opacity-50" aria-hidden="true" />
      )}
    </button>
  );
}

function CopyAddress({ address }: { address: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      type="button"
      onClick={(e) => {
        e.stopPropagation();
        void navigator.clipboard?.writeText(address).then(
          () => {
            setCopied(true);
            setTimeout(() => setCopied(false), 1500);
          },
          () => undefined,
        );
      }}
      className="relative text-zinc-500 transition-colors hover:text-cyan-300"
      aria-label="Copy wallet address"
    >
      {copied ? (
        <Check className="h-3.5 w-3.5 text-emerald-400" aria-hidden="true" />
      ) : (
        <Copy className="h-3.5 w-3.5" aria-hidden="true" />
      )}
      {copied && (
        <span className="absolute -top-6 left-1/2 -translate-x-1/2 whitespace-nowrap rounded bg-zinc-800 px-1.5 py-0.5 text-[10px] text-emerald-400">
          Copied!
        </span>
      )}
    </button>
  );
}

export function LeaderboardTable({
  whales,
  sort,
  onSort,
  onSelect,
  selectedId,
}: Props) {
  return (
    <div className="overflow-hidden rounded-xl border border-zinc-800 bg-surface shadow-lg shadow-black/20">
      <div className="overflow-x-auto scroll-thin">
        <table className="w-full min-w-[960px] border-collapse text-sm">
          <thead>
            <tr className="border-b border-zinc-800 bg-zinc-900/40 text-left">
              <th className="px-4 py-3">
                <SortHeader label="Rank" column="rank" sort={sort} onSort={onSort} />
              </th>
              <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wide text-zinc-500">
                Trader
              </th>
              <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wide text-zinc-500">
                Style
              </th>
              <th className="px-4 py-3 text-right">
                <SortHeader
                  label="Total PnL"
                  column="totalPnl"
                  sort={sort}
                  onSort={onSort}
                  align="right"
                />
              </th>
              <th className="px-4 py-3">
                <SortHeader label="Win Rate" column="winRate" sort={sort} onSort={onSort} />
              </th>
              <th className="px-4 py-3 text-right">
                <SortHeader
                  label="Volume"
                  column="totalVolume"
                  sort={sort}
                  onSort={onSort}
                  align="right"
                />
              </th>
              <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wide text-zinc-500">
                Top Active Position
              </th>
              <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wide text-zinc-500">
                Last Seen
              </th>
            </tr>
          </thead>
          <tbody>
            {whales.map((w) => {
              const selected = w.id === selectedId;
              return (
                <tr
                  key={w.id}
                  onClick={() => onSelect(w)}
                  className={`cursor-pointer border-b border-zinc-800/60 transition-colors ${
                    selected ? "bg-cyan-500/5" : "hover:bg-zinc-800/40"
                  }`}
                >
                  {/* Rank */}
                  <td className="px-4 py-3">
                    <RankCell rank={w.rank} />
                  </td>

                  {/* Trader */}
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <div>
                        <div className="font-medium text-zinc-100">
                          {w.ensName ?? truncateAddress(w.address)}
                        </div>
                        <div className="flex items-center gap-1.5">
                          <span className="font-mono text-xs text-zinc-500">
                            {truncateAddress(w.address)}
                          </span>
                          <CopyAddress address={w.address} />
                          <a
                            href={`https://polymarket.com/profile/${w.address}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            onClick={(e) => e.stopPropagation()}
                            className="text-zinc-500 transition-colors hover:text-cyan-300"
                            aria-label="Open Polymarket profile"
                          >
                            <ExternalLink className="h-3.5 w-3.5" aria-hidden="true" />
                          </a>
                        </div>
                      </div>
                    </div>
                  </td>

                  {/* Style / badges */}
                  <td className="px-4 py-3">
                    <div className="flex max-w-[220px] flex-wrap gap-1">
                      {w.badges.slice(0, 2).map((b) => (
                        <Badge key={b} tone={toneForBadge(b)}>
                          {b}
                        </Badge>
                      ))}
                      {w.badges.length > 2 && (
                        <Badge tone="zinc">+{w.badges.length - 2}</Badge>
                      )}
                    </div>
                  </td>

                  {/* Total PnL */}
                  <td className="px-4 py-3 text-right">
                    <span
                      className={`font-mono text-sm font-bold tabular-nums ${pnlColor(w.totalPnl)}`}
                    >
                      {formatSignedUsd(w.totalPnl)}
                    </span>
                  </td>

                  {/* Win rate */}
                  <td className="px-4 py-3">
                    <div className="w-32">
                      <div className="flex items-center justify-between">
                        <span className="font-mono text-xs font-medium text-zinc-200">
                          {formatPercent(w.winRate)}
                        </span>
                        <span className="font-mono text-[10px] text-zinc-500">
                          {w.wins}W-{w.losses}L
                        </span>
                      </div>
                      <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-zinc-800">
                        <div
                          className="h-full rounded-full bg-emerald-500"
                          style={{ width: `${Math.min(w.winRate, 100)}%` }}
                        />
                      </div>
                    </div>
                  </td>

                  {/* Volume */}
                  <td className="px-4 py-3 text-right">
                    <span className="font-mono text-sm tabular-nums text-zinc-300">
                      {formatCompactUsd(w.totalVolume)}
                    </span>
                  </td>

                  {/* Top active position */}
                  <td className="px-4 py-3">
                    <div className="flex max-w-[260px] items-center gap-2">
                      <OutcomePill outcome={w.currentTopBet.outcome} />
                      <span className="truncate text-xs text-zinc-300" title={w.currentTopBet.marketTitle}>
                        {w.currentTopBet.marketTitle}
                      </span>
                      <span className="shrink-0 font-mono text-xs text-zinc-500">
                        {formatCompactUsd(w.currentTopBet.amount)}
                      </span>
                    </div>
                  </td>

                  {/* Last seen */}
                  <td className="px-4 py-3 text-right">
                    <span className="inline-flex items-center rounded-full border border-zinc-800 bg-zinc-900/60 px-2 py-0.5 font-mono text-[11px] text-zinc-400">
                      {w.lastActive}
                    </span>
                  </td>
                </tr>
              );
            })}
            {whales.length === 0 && (
              <tr>
                <td colSpan={8} className="px-4 py-12 text-center text-sm text-zinc-500">
                  No wallets match your filters.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
