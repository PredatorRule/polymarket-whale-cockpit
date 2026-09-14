// src/components/UpgradeModal.tsx
import { useEffect } from "react";
import { X, Check, Crown } from "lucide-react";
import { PRO_PERKS, PRO_PRICE_AMOUNT, STRIPE_CHECKOUT_URL } from "../lib/pricing";
import { useAuth } from "../context/AuthContext";

/**
 * Pro upgrade modal. Passes the signed-in user's id + email to Stripe as
 * client_reference_id / prefilled email so the webhook can map the resulting
 * subscription back to their Supabase profile.
 */
export function UpgradeModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { user } = useAuth();

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;

  const checkoutUrl = (() => {
    if (!user) return STRIPE_CHECKOUT_URL;
    const u = new URL(STRIPE_CHECKOUT_URL);
    // Stripe Payment Links accept client_reference_id + prefilled_email.
    u.searchParams.set("client_reference_id", user.id);
    if (user.email) u.searchParams.set("prefilled_email", user.email);
    return u.toString();
  })();

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-label="Upgrade to Pro"
    >
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onClose} aria-hidden="true" />
      <div className="relative w-full max-w-md overflow-hidden rounded-2xl border border-zinc-800 bg-surface shadow-2xl shadow-black/50">
        <div className="border-b border-zinc-800 bg-gradient-to-b from-amber-500/10 to-transparent p-5">
          <button
            type="button"
            onClick={onClose}
            className="absolute right-4 top-4 text-zinc-500 transition-colors hover:text-zinc-200"
            aria-label="Close"
          >
            <X className="h-5 w-5" aria-hidden="true" />
          </button>
          <div className="flex h-11 w-11 items-center justify-center rounded-xl border border-amber-500/30 bg-amber-500/10">
            <Crown className="h-5 w-5 text-amber-400" aria-hidden="true" />
          </div>
          <h2 className="mt-3 text-lg font-bold tracking-tight text-zinc-50">
            Upgrade to Pro — {PRO_PRICE_AMOUNT}/mo
          </h2>
          <p className="mt-1 text-sm text-zinc-400">
            Unlock the real-time edge. Cancel anytime.
          </p>
        </div>

        <div className="space-y-3 p-5">
          {PRO_PERKS.map((perk) => (
            <div key={perk} className="flex items-start gap-3">
              <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-emerald-500/15">
                <Check className="h-3 w-3 text-emerald-400" aria-hidden="true" />
              </span>
              <span className="text-sm text-zinc-300">{perk}</span>
            </div>
          ))}

          <div className="mt-2 flex items-end justify-between rounded-xl border border-zinc-800 bg-zinc-900/50 p-4">
            <div>
              <div className="font-mono text-3xl font-bold tabular-nums text-zinc-50">
                {PRO_PRICE_AMOUNT}
                <span className="ml-1 text-sm font-normal text-zinc-500">/ month</span>
              </div>
              <div className="mt-0.5 text-xs text-zinc-500">Cancel anytime with one click</div>
            </div>
            <span className="rounded-full border border-amber-500/30 bg-amber-500/10 px-2 py-0.5 text-xs font-medium text-amber-400">
              Pro
            </span>
          </div>

          <a
            href={checkoutUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-1 flex w-full items-center justify-center gap-2 rounded-xl bg-amber-500 px-4 py-3 text-sm font-semibold text-zinc-950 transition-colors hover:bg-amber-400"
          >
            <Crown className="h-4 w-4" aria-hidden="true" />
            Upgrade to Pro
          </a>
        </div>
      </div>
    </div>
  );
}
