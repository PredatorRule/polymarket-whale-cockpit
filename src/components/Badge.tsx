// src/components/Badge.tsx
import type { ReactNode } from "react";

export type BadgeTone = "amber" | "emerald" | "cyan" | "zinc" | "rose";

const TONES: Record<BadgeTone, string> = {
  amber: "border-amber-500/30 bg-amber-500/10 text-amber-400",
  emerald: "border-emerald-500/30 bg-emerald-500/10 text-emerald-400",
  cyan: "border-cyan-500/30 bg-cyan-500/10 text-cyan-300",
  zinc: "border-zinc-700 bg-zinc-800/60 text-zinc-300",
  rose: "border-rose-500/30 bg-rose-500/10 text-rose-400",
};

/** Map a badge label to a semantic tone. */
export function toneForBadge(label: string): BadgeTone {
  const l = label.toLowerCase();
  if (l.includes("whale") || l.includes("rank") || l.includes("gold") || l.includes("high-roller"))
    return "amber";
  if (l.includes("win") || l.includes("top 1%") || l.includes("pnl")) return "emerald";
  if (l.includes("volume") || l.includes("bot") || l.includes("arb")) return "cyan";
  if (l.includes("contrarian")) return "rose";
  return "zinc";
}

export function Badge({
  children,
  tone = "zinc",
  className = "",
}: {
  children: ReactNode;
  tone?: BadgeTone;
  className?: string;
}) {
  return (
    <span
      className={`inline-flex items-center gap-1 whitespace-nowrap rounded-full border px-2 py-0.5 text-xs font-medium ${TONES[tone]} ${className}`}
    >
      {children}
    </span>
  );
}

/** Small YES/NO pill used throughout the table and drawer. */
export function OutcomePill({ outcome }: { outcome: "YES" | "NO" }) {
  const cls =
    outcome === "YES"
      ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-400"
      : "border-rose-500/30 bg-rose-500/10 text-rose-400";
  return (
    <span
      className={`inline-flex items-center rounded border px-1.5 py-0.5 font-mono text-[10px] font-semibold ${cls}`}
    >
      {outcome}
    </span>
  );
}
