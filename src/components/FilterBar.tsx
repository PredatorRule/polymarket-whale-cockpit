// src/components/FilterBar.tsx
import { Search, Filter as FilterIcon } from "lucide-react";
import type {
  TimeHorizon,
  CategoryFilter,
  WhaleCategory,
} from "../types/whale";

const HORIZONS: { id: TimeHorizon; label: string }[] = [
  { id: "all", label: "All-Time" },
  { id: "30d", label: "30 Days" },
  { id: "7d", label: "7 Days" },
];

const CATEGORIES: CategoryFilter[] = [
  "All",
  "Politics",
  "Macro",
  "Crypto",
  "Pop Culture",
];

const CATEGORY_LABEL: Record<CategoryFilter, string> = {
  All: "All Markets",
  Politics: "Politics",
  Macro: "Macro",
  Crypto: "Crypto",
  "Pop Culture": "Pop Culture",
};

interface Props {
  search: string;
  onSearch: (v: string) => void;
  horizon: TimeHorizon;
  onHorizon: (h: TimeHorizon) => void;
  category: CategoryFilter;
  onCategory: (c: CategoryFilter) => void;
  highPnlOnly: boolean;
  onHighPnlOnly: (v: boolean) => void;
  resultCount: number;
}

export function FilterBar({
  search,
  onSearch,
  horizon,
  onHorizon,
  category,
  onCategory,
  highPnlOnly,
  onHighPnlOnly,
  resultCount,
}: Props) {
  return (
    <div className="rounded-xl border border-zinc-800 bg-surface p-3 shadow-lg shadow-black/20">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        {/* Search */}
        <div className="relative w-full lg:max-w-xs">
          <Search
            className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-500"
            aria-hidden="true"
          />
          <input
            type="text"
            value={search}
            onChange={(e) => onSearch(e.target.value)}
            placeholder="Search address or ENS…"
            aria-label="Search by wallet address or ENS"
            className="w-full rounded-lg border border-zinc-800 bg-zinc-900/70 py-2 pl-9 pr-3 font-mono text-sm text-zinc-100 outline-none transition placeholder:text-zinc-600 focus:border-zinc-600 focus:ring-1 focus:ring-cyan-500/40"
          />
        </div>

        {/* Horizon tabs */}
        <div
          role="tablist"
          aria-label="Time horizon"
          className="inline-flex gap-1 rounded-lg border border-zinc-800 bg-zinc-900/60 p-1"
        >
          {HORIZONS.map((h) => (
            <button
              key={h.id}
              role="tab"
              aria-selected={horizon === h.id}
              onClick={() => onHorizon(h.id)}
              className={`rounded-md px-3 py-1 text-xs font-medium transition ${
                horizon === h.id
                  ? "bg-zinc-100 text-zinc-900"
                  : "text-zinc-400 hover:text-zinc-100"
              }`}
            >
              {h.label}
            </button>
          ))}
        </div>
      </div>

      {/* Category pills + high-PnL toggle */}
      <div className="mt-3 flex flex-col gap-3 border-t border-zinc-800/70 pt-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-wrap items-center gap-1.5">
          {CATEGORIES.map((c) => (
            <button
              key={c}
              onClick={() => onCategory(c)}
              className={`rounded-full border px-3 py-1 text-xs font-medium transition ${
                category === c
                  ? "border-cyan-500/40 bg-cyan-500/10 text-cyan-300"
                  : "border-zinc-800 bg-zinc-900/50 text-zinc-400 hover:text-zinc-200"
              }`}
            >
              {CATEGORY_LABEL[c as CategoryFilter] ??
                CATEGORY_LABEL[c as WhaleCategory]}
            </button>
          ))}
        </div>

        <div className="flex items-center justify-between gap-3">
          <button
            type="button"
            onClick={() => onHighPnlOnly(!highPnlOnly)}
            aria-pressed={highPnlOnly}
            className={`inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-medium transition ${
              highPnlOnly
                ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-400"
                : "border-zinc-800 bg-zinc-900/50 text-zinc-400 hover:text-zinc-200"
            }`}
          >
            <FilterIcon className="h-3.5 w-3.5" aria-hidden="true" />
            PnL &gt; $500k
          </button>
          <span className="font-mono text-xs text-zinc-500">
            {resultCount} wallet{resultCount === 1 ? "" : "s"}
          </span>
        </div>
      </div>
    </div>
  );
}
