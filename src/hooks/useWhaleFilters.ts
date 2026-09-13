// src/hooks/useWhaleFilters.ts
import { useMemo, useState } from "react";
import type {
  WhaleTrader,
  TimeHorizon,
  CategoryFilter,
  SortKey,
  SortState,
} from "../types/whale";
import type { RecentMove } from "../data/useWhaleData";
import { classifyTitles } from "../lib/classify";

const HIGH_PNL_THRESHOLD = 500_000;

export interface UseWhaleFilters {
  search: string;
  setSearch: (v: string) => void;
  horizon: TimeHorizon;
  setHorizon: (h: TimeHorizon) => void;
  category: CategoryFilter;
  setCategory: (c: CategoryFilter) => void;
  highPnlOnly: boolean;
  setHighPnlOnly: (v: boolean) => void;
  sort: SortState;
  toggleSort: (key: SortKey) => void;
  result: WhaleTrader[];
  moves: RecentMove[];
}

/** Returns the PnL field a given horizon sorts/filters on. */
function pnlForHorizon(w: WhaleTrader, horizon: TimeHorizon): number {
  switch (horizon) {
    case "30d":
      return w.pnl30d;
    case "7d":
      return w.pnl7d;
    case "all":
    default:
      return w.totalPnl;
  }
}

export function useWhaleFilters(
  whales: WhaleTrader[],
  allMoves: RecentMove[] = [],
): UseWhaleFilters {
  const [search, setSearch] = useState("");
  const [horizon, setHorizon] = useState<TimeHorizon>("all");
  const [category, setCategory] = useState<CategoryFilter>("All");
  const [highPnlOnly, setHighPnlOnly] = useState(false);
  const [sort, setSort] = useState<SortState>({ key: "rank", direction: "asc" });

  function toggleSort(key: SortKey): void {
    setSort((prev) => {
      if (prev.key === key) {
        return { key, direction: prev.direction === "asc" ? "desc" : "asc" };
      }
      // New column: rank defaults ascending, everything else descending.
      return { key, direction: key === "rank" ? "asc" : "desc" };
    });
  }

  const result = useMemo(() => {
    const q = search.trim().toLowerCase();

    const filtered = whales.filter((w) => {
      if (category !== "All" && w.category !== category) return false;
      if (highPnlOnly && pnlForHorizon(w, horizon) <= HIGH_PNL_THRESHOLD) return false;
      if (q) {
        const hay = `${w.address} ${w.ensName ?? ""}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });

    const sortValue = (w: WhaleTrader): number => {
      switch (sort.key) {
        case "totalPnl":
          return w.totalPnl;
        case "pnl30d":
          return w.pnl30d;
        case "pnl7d":
          return w.pnl7d;
        case "winRate":
          return w.winRate;
        case "totalVolume":
          return w.totalVolume;
        case "rank":
        default:
          return w.rank;
      }
    };

    // When a horizon is active and the user hasn't chosen a PnL column,
    // sort by that horizon's PnL descending so the tabs feel dynamic.
    const effectiveKey: SortKey =
      sort.key === "rank" && horizon !== "all"
        ? horizon === "30d"
          ? "pnl30d"
          : "pnl7d"
        : sort.key;
    const effectiveDir =
      sort.key === "rank" && horizon !== "all" ? "desc" : sort.direction;

    const valueFor = (w: WhaleTrader): number =>
      effectiveKey === sort.key ? sortValue(w) : pnlForHorizon(w, horizon);

    const sorted = [...filtered].sort((a, b) => {
      const av = valueFor(a);
      const bv = valueFor(b);
      return effectiveDir === "asc" ? av - bv : bv - av;
    });

    return sorted;
  }, [whales, search, horizon, category, highPnlOnly, sort]);

  // Apply the same search + category filters to the live moves feed, so the
  // whole page responds to the controls, not just the leaderboard.
  const moves = useMemo(() => {
    const q = search.trim().toLowerCase();
    return allMoves.filter((m) => {
      if (category !== "All" && classifyTitles([m.title]) !== category) return false;
      if (q) {
        const hay = `${m.wallet} ${m.name ?? ""} ${m.title}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [allMoves, search, category]);

  return {
    search,
    setSearch,
    horizon,
    setHorizon,
    category,
    setCategory,
    highPnlOnly,
    setHighPnlOnly,
    sort,
    toggleSort,
    result,
    moves,
  };
}
