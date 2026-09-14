// src/components/TelegramModal.tsx
import { useEffect } from "react";
import { X, Check, Zap, Bell, ShieldCheck, Link2, Send } from "lucide-react";
import type { LucideIcon } from "lucide-react";

import { STRIPE_CHECKOUT_URL } from "../lib/pricing";

// €9/mo checkout (shared single source of truth).
const CHECKOUT_URL = STRIPE_CHECKOUT_URL;

interface ValueProp {
  icon: LucideIcon;
  text: string;
}

const VALUE_PROPS: ValueProp[] = [
  {
    icon: Bell,
    text: "Telegram push alerts within about a minute of a whale's on-chain fill.",
  },
  {
    icon: Zap,
    text: "Each alert shows the market, side, exact size, price, and a direct market link.",
  },
  {
    icon: ShieldCheck,
    text: "Filtered to large trades ($5k+) so you only see moves that matter.",
  },
  {
    icon: Link2,
    text: "Automated delivery — instant private channel access after checkout.",
  },
];

export function TelegramModal({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  // Close on Escape.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-label="Subscribe to real-time whale signals"
    >
      <div
        className="absolute inset-0 bg-black/70 backdrop-blur-sm"
        onClick={onClose}
        aria-hidden="true"
      />
      <div className="relative w-full max-w-md overflow-hidden rounded-2xl border border-zinc-800 bg-surface shadow-2xl shadow-black/50">
        <div className="border-b border-zinc-800 bg-gradient-to-b from-cyan-500/10 to-transparent p-5">
          <button
            type="button"
            onClick={onClose}
            className="absolute right-4 top-4 text-zinc-500 transition-colors hover:text-zinc-200"
            aria-label="Close"
          >
            <X className="h-5 w-5" aria-hidden="true" />
          </button>
          <div className="flex h-11 w-11 items-center justify-center rounded-xl border border-cyan-500/30 bg-cyan-500/10">
            <Send className="h-5 w-5 text-cyan-300" aria-hidden="true" />
          </div>
          <h2 className="mt-3 text-lg font-bold tracking-tight text-zinc-50">
            Never Miss a $100k Whale Move Again
          </h2>
          <p className="mt-1 text-sm text-zinc-400">
            Get a Telegram alert within about a minute of a whale's large on-chain fill.
          </p>
        </div>

        <div className="space-y-3 p-5">
          {VALUE_PROPS.map((v) => (
            <div key={v.text} className="flex items-start gap-3">
              <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-emerald-500/15">
                <Check className="h-3 w-3 text-emerald-400" aria-hidden="true" />
              </span>
              <span className="text-sm text-zinc-300">{v.text}</span>
            </div>
          ))}

          <div className="mt-2 flex items-end justify-between rounded-xl border border-zinc-800 bg-zinc-900/50 p-4">
            <div>
              <div className="font-mono text-3xl font-bold tabular-nums text-zinc-50">
€9
                <span className="ml-1 text-sm font-normal text-zinc-500">/ month</span>
              </div>
              <div className="mt-0.5 text-xs text-zinc-500">
                Cancel anytime with one click
              </div>
            </div>
            <span className="rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2 py-0.5 text-xs font-medium text-emerald-400">
              Live now
            </span>
          </div>

          <a
            href={CHECKOUT_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-1 flex w-full items-center justify-center gap-2 rounded-xl bg-cyan-500 px-4 py-3 text-sm font-semibold text-zinc-950 transition-colors hover:bg-cyan-400"
          >
            <Send className="h-4 w-4" aria-hidden="true" />
            Subscribe &amp; Join Telegram Feed
          </a>
        </div>
      </div>
    </div>
  );
}
