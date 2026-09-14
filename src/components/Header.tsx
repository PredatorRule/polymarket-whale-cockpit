// src/components/Header.tsx
import { Radar, Crown } from "lucide-react";
import { AuthWidget } from "./AuthWidget";

export function Header({
  trackedCount,
  onSignIn,
  onUpgrade,
}: {
  trackedCount: number;
  onSignIn: () => void;
  onUpgrade: () => void;
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

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={onUpgrade}
            className="inline-flex items-center justify-center gap-2 rounded-xl border border-amber-500/40 bg-amber-500/10 px-4 py-2 text-sm font-semibold text-amber-300 transition-colors hover:bg-amber-500/20"
          >
            <Crown className="h-4 w-4" aria-hidden="true" />
            Go Pro!
          </button>
          <AuthWidget onSignIn={onSignIn} onUpgrade={onUpgrade} />
        </div>
      </div>
    </header>
  );
}
