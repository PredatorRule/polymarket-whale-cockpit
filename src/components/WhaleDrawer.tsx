// src/components/WhaleDrawer.tsx
import { useEffect, useState } from "react";
import { X, Lock, TrendingUp, ExternalLink, Send, Star, Link2, Check } from "lucide-react";
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
  isWatched: boolean;
  onToggleWatch: () => void;
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

/**
 * A blurred preview styled like an incoming Telegram whale-alert message, to
 * convey the value of the signal stream (rather than an empty locked box).
 */
function LockedAlertCard({
  side,
  amount,
  onUnlock,
}: {
  side: "YES" | "NO";
  amount: string;
  onUnlock: () => void;
}) {
  return (
    <div className="relative overflow-hidden rounded-lg border border-cyan-500/20 bg-zinc-900/60 p-3">
      {/* Simulated Telegram alert, blurred */}
      <div className="pointer-events-none select-none blur-[6px]" aria-hidden="true">
        <div className="flex items-center gap-2">
          <span className="flex h-6 w-6 items-center justify-center rounded-full bg-cyan-500/20 text-[10px]">
            🚨
          </span>
          <span className="text-xs font-semibold text-zinc-100">WHALE MOVEMENT</span>
          <span
            className={`ml-auto rounded px-1.5 py-0.5 font-mono text-[10px] font-bold ${
              side === "YES" ? "bg-emerald-500/20 text-emerald-300" : "bg-rose-500/20 text-rose-300"
            }`}
          >
            [BOUGHT {side} · {amount}]
          </span>
        </div>
        <div className="mt-2 space-y-1.5">
          <div className="h-2 w-11/12 rounded bg-zinc-700/70" />
          <div className="h-2 w-2/3 rounded bg-zinc-700/50" />
          <div className="h-2 w-4/5 rounded bg-zinc-700/40" />
        </div>
        <div className="mt-2 flex gap-2">
          <div className="h-5 w-24 rounded bg-cyan-500/20" />
          <div className="h-5 w-16 rounded bg-zinc-700/50" />
        </div>
      </div>

      {/* Padlock badge overlay */}
      <div className="absolute right-2 top-2">
        <span className="inline-flex items-center gap-1 rounded-full border border-cyan-500/30 bg-zinc-950/70 px-2 py-0.5 font-mono text-[10px] text-cyan-300">
          <Lock className="h-3 w-3" aria-hidden="true" />
          VIP
        </span>
      </div>
      <button
        type="button"
        onClick={onUnlock}
        className="absolute inset-0 h-full w-full cursor-pointer"
        aria-label="Join the VIP Telegram channel to unlock live signals"
      />
    </div>
  );
}

export function WhaleDrawer({ whale, onClose, onUnlock, isWatched, onToggleWatch }: Props) {
  const [shared, setShared] = useState(false);
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
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={onToggleWatch}
                  className={`rounded-lg p-1.5 transition-colors ${
                    isWatched ? "text-amber-400" : "text-zinc-500 hover:text-zinc-200"
                  }`}
                  aria-label={isWatched ? "Unwatch wallet" : "Watch wallet"}
                  aria-pressed={isWatched}
                >
                  <Star className={`h-5 w-5 ${isWatched ? "fill-amber-400" : ""}`} aria-hidden="true" />
                </button>
                <button
                  type="button"
                  onClick={() => {
                    const u = new URL(window.location.href);
                    u.searchParams.set("wallet", whale.address.toLowerCase());
                    void navigator.clipboard?.writeText(u.toString()).then(
                      () => {
                        setShared(true);
                        setTimeout(() => setShared(false), 1500);
                      },
                      () => undefined,
                    );
                  }}
                  className="rounded-lg p-1.5 text-zinc-500 transition-colors hover:text-cyan-300"
                  aria-label="Copy shareable link to this wallet"
                >
                  {shared ? (
                    <Check className="h-5 w-5 text-emerald-400" aria-hidden="true" />
                  ) : (
                    <Link2 className="h-5 w-5" aria-hidden="true" />
                  )}
                </button>
                <button
                  type="button"
                  onClick={onClose}
                  className="rounded-lg p-1.5 text-zinc-500 transition-colors hover:text-zinc-200"
                  aria-label="Close"
                >
                  <X className="h-5 w-5" aria-hidden="true" />
                </button>
              </div>
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

              {/* Live Telegram signal feed (gated) */}
              <div>
                <div className="mb-2 flex items-center gap-2">
                  <Send className="h-4 w-4 text-cyan-300" aria-hidden="true" />
                  <h3 className="text-sm font-semibold text-zinc-200">
                    Live Telegram Execution Feed
                  </h3>
                </div>
                <div className="space-y-2">
                  <LockedAlertCard side="YES" amount="$150K" onUnlock={onUnlock} />
                  <LockedAlertCard side="NO" amount="$92K" onUnlock={onUnlock} />
                </div>

                {/* Conversion banner */}
                <div className="mt-3 rounded-xl border border-cyan-500/30 bg-cyan-500/5 p-4">
                  <p className="text-xs leading-relaxed text-zinc-300">
                    Live order fills trigger instant price slippage. Zero-latency
                    trade execution and fill alerts are broadcast directly to the
                    private VIP Telegram channel.
                  </p>
                  <a
                    href="https://buy.stripe.com/aFadR12WXeU26jh9h84ko00"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="mt-3 flex w-full items-center justify-center gap-2 rounded-lg bg-cyan-500 px-4 py-2.5 text-sm font-semibold text-zinc-950 transition-colors hover:bg-cyan-400"
                  >
                    <Send className="h-4 w-4" aria-hidden="true" />
                    Join VIP Telegram Channel (€29/mo)
                  </a>
                </div>
              </div>
            </div>
          </>
        )}
      </aside>
    </>
  );
}
