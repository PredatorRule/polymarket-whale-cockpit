// src/components/Header.tsx
import { Radar, Send } from "lucide-react";

export function Header({
  onOpenTelegram,
  trackedCount,
}: {
  onOpenTelegram: () => void;
  trackedCount: number;
}) {
  return (
    <header className="sticky top-0 z-30 border-b border-zinc-800 bg-zinc-950/80 backdrop-blur-md">
      <div className="mx-auto flex max-w-7xl flex-col gap-3 px-4 py-3 sm:flex-row sm:items-center sm:justify-between sm:py-4">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-emerald-500/30 bg-emerald-500/10">
            <Radar className="h-5 w-5 text-emerald-400" aria-hidden="true" />
          </div>
          <div>
            <h1 className="text-base font-bold tracking-tight text-zinc-50 sm:text-lg">
              Polymarket Whale Cockpit
            </h1>
            <div className="mt-0.5 flex items-center gap-2">
              <span
                className="inline-flex h-2 w-2 rounded-full bg-emerald-400 animate-beacon"
                aria-hidden="true"
              />
              <span className="font-mono text-[11px] text-zinc-500">
                {trackedCount > 0
                  ? `Tracking top ${trackedCount} wallets · Polygon Mainnet`
                  : "Live · Polygon Mainnet"}
              </span>
            </div>
          </div>
        </div>

        <button
          type="button"
          onClick={onOpenTelegram}
          className="inline-flex items-center justify-center gap-2 rounded-xl border border-cyan-500/40 bg-cyan-500/10 px-4 py-2 text-sm font-semibold text-cyan-300 transition-colors hover:bg-cyan-500/20"
        >
          <Send className="h-4 w-4" aria-hidden="true" />
          Get Real-Time Signals
        </button>
      </div>
    </header>
  );
}
