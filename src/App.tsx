// src/App.tsx
import { useState } from "react";
import { Loader2, AlertTriangle } from "lucide-react";
import { Header } from "./components/Header";
import { StatCards } from "./components/StatCards";
import { FilterBar } from "./components/FilterBar";
import { LeaderboardTable } from "./components/LeaderboardTable";
import { RecentMoves } from "./components/RecentMoves";
import { WhaleDrawer } from "./components/WhaleDrawer";
import { TelegramModal } from "./components/TelegramModal";
import { useWhaleFilters } from "./hooks/useWhaleFilters";
import { useWhaleData, lookupWallet } from "./data/useWhaleData";
import type { WhaleTrader } from "./types/whale";

export default function App() {
  const { whales, recentMoves, source, lastUpdated, trackedCount } = useWhaleData();
  const filters = useWhaleFilters(whales, recentMoves);
  const [selected, setSelected] = useState<WhaleTrader | null>(null);
  const [telegramOpen, setTelegramOpen] = useState(false);
  const [lookupLoading, setLookupLoading] = useState(false);
  const [lookupError, setLookupError] = useState<string | null>(null);

  const ready = source === "live" && whales.length > 0;

  const handleLookup = async (address: string) => {
    setLookupLoading(true);
    setLookupError(null);
    try {
      const whale = await lookupWallet(address);
      if (whale) {
        setSelected(whale);
      } else {
        setLookupError("No public data found for that wallet.");
      }
    } finally {
      setLookupLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-zinc-950 bg-[radial-gradient(ellipse_at_top,rgba(16,185,129,0.05),transparent_55%)]">
      <Header onOpenTelegram={() => setTelegramOpen(true)} trackedCount={trackedCount} />

      <main className="mx-auto max-w-7xl space-y-4 px-4 py-6">
        {source === "loading" && (
          <div className="flex flex-col items-center justify-center gap-3 py-24 text-zinc-500">
            <Loader2 className="h-6 w-6 animate-spin text-cyan-400" aria-hidden="true" />
            <span className="font-mono text-sm">Loading live Polymarket leaderboard…</span>
          </div>
        )}

        {source === "error" && (
          <div className="flex flex-col items-center justify-center gap-3 py-24 text-center text-zinc-500">
            <AlertTriangle className="h-6 w-6 text-amber-400" aria-hidden="true" />
            <span className="font-mono text-sm">Couldn't reach the live Polymarket data feed.</span>
            <button
              type="button"
              onClick={() => window.location.reload()}
              className="rounded-lg border border-zinc-800 bg-surface px-4 py-2 text-sm text-zinc-300 transition-colors hover:bg-zinc-800"
            >
              Retry
            </button>
          </div>
        )}

        {ready && (
          <>
            <FilterBar
              search={filters.search}
              onSearch={filters.setSearch}
              horizon={filters.horizon}
              onHorizon={filters.setHorizon}
              category={filters.category}
              onCategory={filters.setCategory}
              highPnlOnly={filters.highPnlOnly}
              onHighPnlOnly={filters.setHighPnlOnly}
              resultCount={filters.result.length}
              onLookup={handleLookup}
              lookupLoading={lookupLoading}
            />

            {lookupError && (
              <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 px-4 py-2 text-sm text-amber-300">
                {lookupError}
              </div>
            )}

            <StatCards whales={filters.result} />

            <RecentMoves moves={filters.moves} />

            <LeaderboardTable
              whales={filters.result}
              sort={filters.sort}
              onSort={filters.toggleSort}
              onSelect={setSelected}
              selectedId={selected?.id}
            />

            <footer className="flex flex-wrap items-center justify-center gap-2 pt-2 text-center text-xs text-zinc-600">
              <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2 py-0.5 font-mono text-emerald-400">
                <span className="inline-flex h-1.5 w-1.5 rounded-full bg-emerald-400 animate-beacon" />
                Live · Polymarket public data
              </span>
              {lastUpdated && (
                <span className="font-mono">
                  updated {new Date(lastUpdated).toLocaleTimeString()}
                </span>
              )}
              <span>Not financial advice.</span>
            </footer>
          </>
        )}
      </main>

      <WhaleDrawer
        whale={selected}
        onClose={() => setSelected(null)}
        onUnlock={() => setTelegramOpen(true)}
      />

      <TelegramModal open={telegramOpen} onClose={() => setTelegramOpen(false)} />
    </div>
  );
}
