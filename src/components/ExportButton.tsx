// src/components/ExportButton.tsx
import { Download, Lock } from "lucide-react";
import type { WhaleTrader } from "../types/whale";
import { useAuth } from "../context/AuthContext";

function toCsv(rows: WhaleTrader[]): string {
  const header = [
    "rank",
    "address",
    "ens",
    "category",
    "totalPnl",
    "pnl30d",
    "pnl7d",
    "winRate",
    "wins",
    "losses",
    "maxDrawdownUsdc",
    "totalVolume",
    "activePositions",
  ];
  const escape = (v: string | number): string => {
    const s = String(v);
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const lines = rows.map((w) =>
    [
      w.rank,
      w.address,
      w.ensName ?? "",
      w.category,
      w.totalPnl.toFixed(2),
      w.pnl30d.toFixed(2),
      w.pnl7d.toFixed(2),
      w.winRate.toFixed(2),
      w.wins,
      w.losses,
      w.maxDrawdownUsdc.toFixed(2),
      w.totalVolume.toFixed(2),
      w.activePositionsCount,
    ]
      .map(escape)
      .join(","),
  );
  return [header.join(","), ...lines].join("\n");
}

/** CSV export, gated behind Pro. Free users get the upgrade modal instead. */
export function ExportButton({
  rows,
  onLocked,
}: {
  rows: WhaleTrader[];
  onLocked: () => void;
}) {
  const { isPro } = useAuth();

  const handleClick = () => {
    if (!isPro) {
      onLocked();
      return;
    }
    const blob = new Blob([toCsv(rows)], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `polymarket-whales-${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  };

  return (
    <button
      type="button"
      onClick={handleClick}
      className="inline-flex items-center gap-1.5 rounded-lg border border-zinc-800 bg-zinc-900/60 px-3 py-1.5 text-xs font-medium text-zinc-300 transition-colors hover:bg-zinc-800"
      title={isPro ? "Download the current leaderboard as CSV" : "Pro feature — €9/mo"}
    >
      {isPro ? (
        <Download className="h-3.5 w-3.5" aria-hidden="true" />
      ) : (
        <Lock className="h-3.5 w-3.5 text-amber-400" aria-hidden="true" />
      )}
      Export CSV
    </button>
  );
}
