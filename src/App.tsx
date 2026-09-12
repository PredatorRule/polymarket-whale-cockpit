// src/App.tsx
import { useState } from "react";
import { Header } from "./components/Header";
import { StatCards } from "./components/StatCards";
import { FilterBar } from "./components/FilterBar";
import { LeaderboardTable } from "./components/LeaderboardTable";
import { WhaleDrawer } from "./components/WhaleDrawer";
import { TelegramModal } from "./components/TelegramModal";
import { useWhaleFilters } from "./hooks/useWhaleFilters";
import { mockWhales } from "./data/mockWhales";
import type { WhaleTrader } from "./types/whale";

export default function App() {
  const filters = useWhaleFilters(mockWhales);
  const [selected, setSelected] = useState<WhaleTrader | null>(null);
  const [telegramOpen, setTelegramOpen] = useState(false);

  return (
    <div className="min-h-screen bg-zinc-950 bg-[radial-gradient(ellipse_at_top,rgba(16,185,129,0.05),transparent_55%)]">
      <Header onOpenTelegram={() => setTelegramOpen(true)} />

      <main className="mx-auto max-w-7xl space-y-4 px-4 py-6">
        <StatCards whales={mockWhales} />

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

        <footer className="pt-2 text-center text-xs text-zinc-600">
          Demo data for illustration. Not financial advice.
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
