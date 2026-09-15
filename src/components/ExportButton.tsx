// src/components/ExportButton.tsx
import { useState } from "react";
import { Download, Lock, Loader2 } from "lucide-react";

/**
 * CSV export via the protected /api/export-csv endpoint. The server returns 403
 * for non-Pro callers (the CSV is never generated client-side), so a free user
 * gets the upgrade modal instead of a file.
 *
 * `type` selects the dataset: the ranked leaderboard, or the live moves feed.
 */
export function ExportButton({
  type = "leaderboard",
  label,
  accessToken,
  isPro,
  onLocked,
}: {
  type?: "leaderboard" | "moves";
  label?: string;
  accessToken: string | null | undefined;
  isPro: boolean;
  onLocked: () => void;
}) {
  const [busy, setBusy] = useState(false);
  const text = label ?? (type === "moves" ? "Export moves" : "Export leaderboard");

  const handleClick = async () => {
    setBusy(true);
    try {
      const res = await fetch(`/api/export-csv?type=${type}`, {
        headers: accessToken ? { authorization: `Bearer ${accessToken}` } : {},
      });
      if (res.status === 403) {
        onLocked();
        return;
      }
      if (!res.ok) return;
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      const kind = type === "moves" ? "moves" : "leaderboard";
      a.download = `polymarket-whale-${kind}-${new Date().toISOString().slice(0, 10)}.csv`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } finally {
      setBusy(false);
    }
  };

  return (
    <button
      type="button"
      onClick={() => void handleClick()}
      disabled={busy}
      className="inline-flex items-center gap-1.5 rounded-lg border border-zinc-800 bg-zinc-900/60 px-3 py-1.5 text-xs font-medium text-zinc-300 transition-colors hover:bg-zinc-800 disabled:opacity-60"
      title={`Export the ${type === "moves" ? "live whale movements" : "leaderboard"} as CSV (Pro)`}
    >
      {busy ? (
        <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />
      ) : isPro ? (
        <Download className="h-3.5 w-3.5" aria-hidden="true" />
      ) : (
        <Lock className="h-3.5 w-3.5 text-amber-400" aria-hidden="true" />
      )}
      {text}
    </button>
  );
}
