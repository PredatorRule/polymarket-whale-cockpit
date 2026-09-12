// src/components/WhaleDrawer.tsx
import { useEffect } from "react";
import { X, Lock, TrendingUp, ExternalLink, Zap } from "lucide-react";
import type { WhaleTrader, WhalePosition } from "../types/whale";
import {
  formatSignedUsd,
  formatCompactUsd,
  formatPercent,
  formatSignedPercent,
  truncateAddress,
  formatCents,
  pnlColor,
} from "../lib/format";
import { Badge, OutcomePill, toneForBadge } from "./Badge";

interface Props {
  whale: WhaleTrader | null;
  onClose: () => void;
  onUnlock: () => void;
}

function VisibleTrade({ p }: { p: WhalePosition }) {
  return (
    <div className="rounded-lg border border-zinc-800 bg-zinc-900/50 p-3">
      <div className="flex items-start justify-between gap-2">
        <span className="text-sm text-zinc-200">{p.marketTitle}</span>
        <OutcomePill outcome={p.outcome} />
      </div>
      <div className="mt-2 grid grid-cols-3 gap-2 font-mono text-xs">
        <div>
          <div className="text-zinc-500">Entry</div>
          <div className="text-zinc-300">{formatCents(p.avgPrice)}</div>
        </div>
        <div>
          <div className="text-zinc-500">Size</div>
          <div className="text-zinc-300">{formatCompactUsd(p.totalCost)}</div>
        </div>
        <div className="text-right">
          <div className="text-zinc-500">PnL</div>
          <div className={pnlColor(p.pnl)}>
            {formatSignedUsd(p.pnl)}{" "}
            <span className="text-[10px]">({formatSignedPercent(p.pnlPercent)})</span>
          </div>
        </div>
      </div>
    </div>
  );
}

function LockedTrade({ p, onUnlock }: { p: WhalePosition; onUnlock: () => void }) {
  return (
    <div className="relative overflow-hidden rounded-lg border border-zinc-800 bg-zinc-900/50 p-3">
      {/* Blurred underlying content */}
      <div className="pointer-events-none select-none blur-md" aria-hidden="true">
        <div className="flex items-start justify-between gap-2">
          <span className="text-sm text-zinc-200">{p.marketTitle}</span>
          <OutcomePill outcome={p.outcome} />
        </div>
        <div className="mt-2 grid grid-cols-3 gap-2 font-mono text-xs">
          <div>
            <div className="text-zinc-500">Entry</div>
            <div className="text-zinc-300">{formatCents(p.avgPrice)}</div>
          </div>
          <div>
            <div className="text-zinc-500">Size</div>
            <div className="text-zinc-300">{formatCompactUsd(p.totalCost)}</div>
          </div>
          <div className="text-right">
            <div className="text-zinc-500">PnL</div>
            <div className="text-emerald-400">{formatSignedUsd(p.pnl)}</div>
          </div>
        </div>
      </div>
      {/* Lock overlay */}
      <div className="absolute inset-0 flex items-center justify-center">
        <Lock className="h-5 w-5 text-cyan-300" aria-hidden="true" />
      </div>
      <button
        type="button"
        onClick={onUnlock}
        className="absolute inset-0 h-full w-full cursor-pointer"
        aria-label="Unlock active whale positions"
      />
    </div>
  );
}

export function WhaleDrawer({ whale, onClose, onUnlock }: Props) {
  useEffect(() => {
    if (!whale) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [whale, onClose]);

  const open = whale !== null;
  const visible = whale?.positions.filter((p) => !p.isLocked).slice(0, 2) ?? [];
  const locked = whale?.positions.filter((p) => p.isLocked).slice(0, 2) ?? [];

  return (
    <>
      {/* Backdrop */}
      <div
        className={`fixed inset-0 z-40 bg-black/60 transition-opacity duration-300 ${
          open ? "opacity-100" : "pointer-events-none opacity-0"
        }`}
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Slide-over panel */}
      <aside
        className={`fixed right-0 top-0 z-50 flex h-full w-full max-w-md flex-col border-l border-zinc-800 bg-surface shadow-2xl shadow-black/50 transition-transform duration-300 ease-out ${
          open ? "translate-x-0" : "translate-x-full"
        }`}
        role="dialog"
        aria-modal="true"
        aria-label="Whale details"
      >
        {whale && (
          <>
            {/* Header */}
            <div className="flex items-start justify-between border-b border-zinc-800 p-5">
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="text-lg font-bold tracking-tight text-zinc-50">
                    {whale.ensName ?? truncateAddress(whale.address)}
                  </h2>
                  <span className="font-mono text-xs text-zinc-500">#{whale.rank}</span>
                </div>
                <div className="mt-1 flex items-center gap-1.5">
                  <span className="font-mono text-xs text-zinc-500">
                    {truncateAddress(whale.address)}
                  </span>
                  <a
                    href={`https://polymarket.com/profile/${whale.address}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-zinc-500 transition-colors hover:text-cyan-300"
                    aria-label="Open Polymarket profile"
                  >
                    <ExternalLink className="h-3.5 w-3.5" aria-hidden="true" />
                  </a>
                </div>
              </div>
              <button
                type="button"
                onClick={onClose}
                className="text-zinc-500 transition-colors hover:text-zinc-200"
                aria-label="Close"
              >
                <X className="h-5 w-5" aria-hidden="true" />
              </button>
            </div>

            {/* Scrollable body */}
            <div className="flex-1 space-y-5 overflow-y-auto scroll-thin p-5">
              {/* Badges */}
              <div className="flex flex-wrap gap-1.5">
                {whale.badges.map((b) => (
                  <Badge key={b} tone={toneForBadge(b)}>
                    {b}
                  </Badge>
                ))}
              </div>

              {/* Summary metrics */}
              <div className="grid grid-cols-2 gap-3">
                <div className="rounded-lg border border-zinc-800 bg-zinc-900/50 p-3">
                  <div className="text-xs uppercase tracking-wide text-zinc-500">
                    Total PnL
                  </div>
                  <div className={`mt-1 font-mono text-lg font-bold ${pnlColor(whale.totalPnl)}`}>
                    {formatSignedUsd(whale.totalPnl)}
                  </div>
                </div>
                <div className="rounded-lg border border-zinc-800 bg-zinc-900/50 p-3">
                  <div className="text-xs uppercase tracking-wide text-zinc-500">
                    30d PnL
                  </div>
                  <div className={`mt-1 font-mono text-lg font-bold ${pnlColor(whale.pnl30d)}`}>
                    {formatSignedUsd(whale.pnl30d)}
                  </div>
                </div>
                <div className="rounded-lg border border-zinc-800 bg-zinc-900/50 p-3">
                  <div className="text-xs uppercase tracking-wide text-zinc-500">
                    Win Rate
                  </div>
                  <div className="mt-1 flex items-center justify-between">
                    <span className="font-mono text-lg font-bold text-zinc-100">
                      {formatPercent(whale.winRate)}
                    </span>
                    <span className="font-mono text-[10px] text-zinc-500">
                      {whale.wins}W-{whale.losses}L
                    </span>
                  </div>
                  <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-zinc-800">
                    <div
                      className="h-full rounded-full bg-emerald-500"
                      style={{ width: `${Math.min(whale.winRate, 100)}%` }}
                    />
                  </div>
                </div>
                <div className="rounded-lg border border-zinc-800 bg-zinc-900/50 p-3">
                  <div className="text-xs uppercase tracking-wide text-zinc-500">
                    Total Volume
                  </div>
                  <div className="mt-1 font-mono text-lg font-bold text-cyan-300">
                    {formatCompactUsd(whale.totalVolume)}
                  </div>
                </div>
              </div>

              {/* Visible historical trades */}
              <div>
                <div className="mb-2 flex items-center gap-2">
                  <TrendingUp className="h-4 w-4 text-emerald-400" aria-hidden="true" />
                  <h3 className="text-sm font-semibold text-zinc-200">
                    Recent Closed Trades
                  </h3>
                </div>
                <div className="space-y-2">
                  {visible.map((p) => (
                    <VisibleTrade key={p.id} p={p} />
                  ))}
                </div>
              </div>

              {/* Locked alpha trades */}
              <div>
                <div className="mb-2 flex items-center gap-2">
                  <Lock className="h-4 w-4 text-cyan-300" aria-hidden="true" />
                  <h3 className="text-sm font-semibold text-zinc-200">
                    Active Positions (Locked)
                  </h3>
                </div>
                <div className="space-y-2">
                  {locked.map((p) => (
                    <LockedTrade key={p.id} p={p} onUnlock={onUnlock} />
                  ))}
                </div>

                {/* Conversion banner */}
                <div className="mt-3 rounded-xl border border-cyan-500/30 bg-cyan-500/5 p-4">
                  <p className="text-xs leading-relaxed text-zinc-300">
                    Active whale orders trigger immediate slippage. Instant,
                    0-latency order execution and fill alerts are exclusive to Pro
                    members.
                  </p>
                  <button
                    type="button"
                    onClick={onUnlock}
                    className="mt-3 flex w-full items-center justify-center gap-2 rounded-lg bg-cyan-500 px-4 py-2.5 text-sm font-semibold text-zinc-950 transition-colors hover:bg-cyan-400"
                  >
                    <Zap className="h-4 w-4" aria-hidden="true" />
                    Unlock Instant Whale Feeds ($29/mo)
                  </button>
                </div>
              </div>
            </div>
          </>
        )}
      </aside>
    </>
  );
}
