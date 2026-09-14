// src/components/UpgradeSuccess.tsx
import { useEffect, useState } from "react";
import { Crown, Loader2, ArrowRight } from "lucide-react";
import { useAuth } from "../context/AuthContext";

/**
 * Post-checkout landing (/upgrade/success). Stripe redirects here after payment.
 * The webhook flips plan=pro asynchronously, so we poll the profile a few times
 * before giving up gracefully — then send the user back to the cockpit.
 */
export function UpgradeSuccess() {
  const { isPro, refreshProfile, user, configured } = useAuth();
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    if (!configured) {
      setChecking(false);
      return;
    }
    let active = true;
    let attempts = 0;

    const poll = async () => {
      attempts += 1;
      await refreshProfile();
      if (!active) return;
      // Stop once Pro is confirmed or after ~10 tries (~20s).
      if (attempts >= 10) {
        setChecking(false);
        return;
      }
      setTimeout(poll, 2000);
    };
    void poll();

    return () => {
      active = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [configured]);

  useEffect(() => {
    if (isPro) setChecking(false);
  }, [isPro]);

  const goHome = () => {
    window.history.pushState({}, "", "/");
    window.dispatchEvent(new PopStateEvent("popstate"));
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-zinc-950 bg-[radial-gradient(ellipse_at_top,rgba(245,158,11,0.08),transparent_55%)] p-4">
      <div className="w-full max-w-md rounded-2xl border border-zinc-800 bg-surface p-8 text-center shadow-2xl shadow-black/40">
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl border border-amber-500/30 bg-amber-500/10">
          <Crown className="h-7 w-7 text-amber-400" aria-hidden="true" />
        </div>

        {isPro ? (
          <>
            <h1 className="mt-4 text-2xl font-bold tracking-tight text-zinc-50">You're Pro ✅</h1>
            <p className="mt-2 text-sm text-zinc-400">
              Payment confirmed{user?.email ? ` for ${user.email}` : ""}. Zero-delay feed,
              full wallet analytics, unlimited CSV, and VIP alerts are all unlocked.
            </p>
          </>
        ) : checking ? (
          <>
            <h1 className="mt-4 flex items-center justify-center gap-2 text-xl font-bold text-zinc-50">
              <Loader2 className="h-5 w-5 animate-spin text-amber-400" aria-hidden="true" />
              Activating Pro…
            </h1>
            <p className="mt-2 text-sm text-zinc-400">
              Thanks for subscribing! We're confirming your payment — this takes a few seconds.
            </p>
          </>
        ) : (
          <>
            <h1 className="mt-4 text-xl font-bold text-zinc-50">Almost there</h1>
            <p className="mt-2 text-sm text-zinc-400">
              Your payment is processing. Pro unlocks automatically once it clears —
              usually within a minute. Refresh the cockpit if it hasn't appeared shortly.
            </p>
          </>
        )}

        <button
          type="button"
          onClick={goHome}
          className="mt-6 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-amber-500 px-4 py-3 text-sm font-semibold text-zinc-950 transition-colors hover:bg-amber-400"
        >
          Go to the cockpit
          <ArrowRight className="h-4 w-4" aria-hidden="true" />
        </button>
      </div>
    </div>
  );
}
