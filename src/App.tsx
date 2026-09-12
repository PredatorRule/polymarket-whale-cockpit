// src/App.tsx
import { useState } from "react";
import { Header } from "./components/Header";
import { StatCards } from "./components/StatCards";
import { FilterBar } from "./components/FilterBar";
import { LeaderboardTable } from "./components/LeaderboardTable";
import { WhaleDrawer } from "./components/WhaleDrawer";
import { TelegramModal } from "./components/TelegramModal";
import { useWhaleFilters } from "./hooks/useWhaleFilters";
import { useWhaleData } from "./data/useWhaleData";
import type { WhaleTrader } from "./types/whale";

export default function App() {
  const { whales, source } = useWhaleData();
  const filters = useWhaleFilters(whales);
  const [selected, setSelected] = useState<WhaleTrader | null>(null);
  const [telegramOpen, setTelegramOpen] = useState(false);

  return (
    <div className="min-h-screen bg-zinc-950 bg-[radial-gradient(ellipse_at_top,rgba(16,185,129,0.05),transparent_55%)]">
      <Header onOpenTelegram={() => setTelegramOpen(true)} />

      <main className="mx-auto max-w-7xl space-y-4 px-4 py-6">
        <StatCards whales={whales} />

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
        />

        <LeaderboardTable
          whales={filters.result}
          sort={filters.sort}
          onSort={filters.toggleSort}
          onSelect={setSelected}
          selectedId={selected?.id}
        />

        <footer className="flex items-center justify-center gap-2 pt-2 text-center text-xs text-zinc-600">
          <span
            className={`inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 font-mono ${
              source === "live"
                ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-400"
                : "border-zinc-800 bg-zinc-900/60 text-zinc-500"
            }`}
          >
            <span
              className={`inline-flex h-1.5 w-1.5 rounded-full ${
                source === "live" ? "bg-emerald-400" : "bg-zinc-600"
              }`}
            />
            {source === "live"
              ? "Live Apify data"
              : source === "loading"
                ? "Loading…"
                : "Demo data"}
          </span>
          <span>Not financial advice.</span>
        </footer>
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
