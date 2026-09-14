// src/App.tsx
import { useState, useEffect, useMemo } from "react";
import { Loader2, AlertTriangle } from "lucide-react";
import { Header } from "./components/Header";
import { StatCards } from "./components/StatCards";
import { FilterBar } from "./components/FilterBar";
import { LeaderboardTable } from "./components/LeaderboardTable";
import { RecentMoves } from "./components/RecentMoves";
import { WhaleDrawer } from "./components/WhaleDrawer";
import { TelegramModal } from "./components/TelegramModal";
import { SignInModal } from "./components/SignInModal";
import { UpgradeModal } from "./components/UpgradeModal";
import { ExportButton } from "./components/ExportButton";
import { useWhaleFilters } from "./hooks/useWhaleFilters";
import { useWatchlist } from "./hooks/useWatchlist";
import { useWhaleData, lookupWallet } from "./data/useWhaleData";
import { useAuth } from "./context/AuthContext";
import type { WhaleTrader } from "./types/whale";
import type { RecentMove } from "./data/useWhaleData";

// Free tier sees the live feed delayed by this many seconds.
const FREE_DELAY_SECONDS = 10 * 60;

function walletFromUrl(): string | null {
  const p = new URLSearchParams(window.location.search).get("wallet");
  return p && /^0x[0-9a-fA-F]{40}$/.test(p) ? p.toLowerCase() : null;
}

export default function App() {
  const { whales, recentMoves, source, lastUpdated, trackedCount } = useWhaleData();
  const { isPro } = useAuth();
  const watchlist = useWatchlist();
  const filters = useWhaleFilters(whales, recentMoves, watchlist.isWatched);
  const [selected, setSelected] = useState<WhaleTrader | null>(null);
  const [telegramOpen, setTelegramOpen] = useState(false);
  const [signInOpen, setSignInOpen] = useState(false);
  const [upgradeOpen, setUpgradeOpen] = useState(false);
  const [lookupLoading, setLookupLoading] = useState(false);
  const [lookupError, setLookupError] = useState<string | null>(null);

  const ready = source === "live" && whales.length > 0;

  // Live-feed gating: Pro sees everything now; free users see only trades
  // older than the delay window, and a count of how many are being withheld.
  const { visibleMoves, delayedCount } = useMemo(() => {
    if (isPro) return { visibleMoves: filters.moves, delayedCount: 0 };
    const cutoff = Math.floor(Date.now() / 1000) - FREE_DELAY_SECONDS;
    const shown: RecentMove[] = [];
    let delayed = 0;
    for (const m of filters.moves) {
      if (m.timestamp <= cutoff) shown.push(m);
      else delayed++;
    }
    return { visibleMoves: shown, delayedCount: delayed };
  }, [filters.moves, isPro]);

  const openWallet = async (address: string, pushUrl: boolean) => {
    setLookupLoading(true);
    setLookupError(null);
    try {
      const whale = await lookupWallet(address);
      if (whale) {
        setSelected(whale);
        if (pushUrl) {
          const u = new URL(window.location.href);
          u.searchParams.set("wallet", address.toLowerCase());
          window.history.pushState({}, "", u);
        }
      } else {
        setLookupError("No public data found for that wallet.");
      }
    } finally {
      setLookupLoading(false);
    }
  };

  const handleLookup = (address: string) => void openWallet(address, true);

  useEffect(() => {
    const w = walletFromUrl();
    if (w) void openWallet(w, false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleSelect = (w: WhaleTrader) => {
    setSelected(w);
    const u = new URL(window.location.href);
    u.searchParams.set("wallet", w.address.toLowerCase());
    window.history.replaceState({}, "", u);
  };

  const handleCloseDrawer = () => {
    setSelected(null);
    const u = new URL(window.location.href);
    u.searchParams.delete("wallet");
    window.history.replaceState({}, "", u);
  };

  return (
    <div className="min-h-screen bg-zinc-950 bg-[radial-gradient(ellipse_at_top,rgba(16,185,129,0.05),transparent_55%)]">
      <Header
        onOpenTelegram={() => setTelegramOpen(true)}
        trackedCount={trackedCount}
        onSignIn={() => setSignInOpen(true)}
        onUpgrade={() => setUpgradeOpen(true)}
      />

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
            <div className="flex items-center justify-between gap-3">
              <FilterBar
                search={filters.search}
                onSearch={filters.setSearch}
                horizon={filters.horizon}
                onHorizon={filters.setHorizon}
                category={filters.category}
                onCategory={filters.setCategory}
                highPnlOnly={filters.highPnlOnly}
                onHighPnlOnly={filters.setHighPnlOnly}
                watchedOnly={filters.watchedOnly}
                onWatchedOnly={filters.setWatchedOnly}
                watchlistCount={watchlist.count}
                resultCount={filters.result.length}
                onLookup={handleLookup}
                lookupLoading={lookupLoading}
              />
            </div>

            {lookupError && (
              <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 px-4 py-2 text-sm text-amber-300">
                {lookupError}
              </div>
            )}

            <StatCards whales={filters.result} moves={filters.moves} />

            <div className="flex items-center justify-end">
              <ExportButton rows={filters.result} onLocked={() => setUpgradeOpen(true)} />
            </div>

            <RecentMoves
              moves={visibleMoves}
              delayedCount={delayedCount}
              isPro={isPro}
              onUpgrade={() => setUpgradeOpen(true)}
            />

            <LeaderboardTable
              whales={filters.result}
              sort={filters.sort}
              onSort={filters.toggleSort}
              onSelect={handleSelect}
              selectedId={selected?.id}
              isWatched={watchlist.isWatched}
              onToggleWatch={watchlist.toggle}
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
              <a href="/faq" className="hover:text-zinc-300">FAQ</a>
              <a href="/how-it-works" className="hover:text-zinc-300">How it works</a>
              <a
                href="https://prediction-market-arb-cockpit.pages.dev/"
                target="_blank"
                rel="noopener noreferrer"
                className="hover:text-zinc-300"
              >
                Arbitrage Calculator ↗
              </a>
              <span>Not financial advice.</span>
            </footer>
          </>
        )}
      </main>

      <WhaleDrawer
        whale={selected}
        onClose={handleCloseDrawer}
        onUnlock={() => setTelegramOpen(true)}
        isWatched={selected ? watchlist.isWatched(selected.address) : false}
        onToggleWatch={() => selected && watchlist.toggle(selected.address)}
        isPro={isPro}
        onUpgrade={() => setUpgradeOpen(true)}
      />

      <TelegramModal open={telegramOpen} onClose={() => setTelegramOpen(false)} />
      <SignInModal open={signInOpen} onClose={() => setSignInOpen(false)} />
      <UpgradeModal open={upgradeOpen} onClose={() => setUpgradeOpen(false)} />
    </div>
  );
}
