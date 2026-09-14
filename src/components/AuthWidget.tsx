// src/components/AuthWidget.tsx
import { LogOut, Crown } from "lucide-react";
import { useAuth } from "../context/AuthContext";

interface Props {
  onSignIn: () => void;
  onUpgrade: () => void;
}

export function AuthWidget({ onSignIn, onUpgrade }: Props) {
  const { configured, user, isPro, logout, loading } = useAuth();

  // If Supabase isn't configured, hide auth entirely (app stays public).
  if (!configured) return null;
  if (loading) {
    return <div className="h-8 w-20 animate-pulse rounded-lg bg-zinc-800/60" aria-hidden="true" />;
  }

  if (!user) {
    return (
      <button
        type="button"
        onClick={onSignIn}
        className="rounded-xl border border-zinc-700 bg-zinc-900/70 px-4 py-2 text-sm font-semibold text-zinc-200 transition-colors hover:bg-zinc-800"
      >
        Sign In
      </button>
    );
  }

  return (
    <div className="flex items-center gap-2">
      {!isPro && (
        <button
          type="button"
          onClick={onUpgrade}
          className="inline-flex items-center gap-1.5 rounded-xl border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-xs font-semibold text-amber-400 transition-colors hover:bg-amber-500/20"
        >
          <Crown className="h-3.5 w-3.5" aria-hidden="true" />
          Upgrade to Pro — €9/mo
        </button>
      )}
      <span
        className={`hidden rounded-full border px-2 py-0.5 font-mono text-[10px] font-semibold sm:inline ${
          isPro
            ? "border-amber-500/40 bg-amber-500/10 text-amber-400"
            : "border-zinc-700 bg-zinc-800/60 text-zinc-400"
        }`}
      >
        {isPro ? "PRO" : "FREE"}
      </span>
      <span className="hidden max-w-[160px] truncate text-xs text-zinc-400 md:inline" title={user.email ?? ""}>
        {user.email}
      </span>
      <button
        type="button"
        onClick={() => void logout()}
        className="rounded-lg p-2 text-zinc-500 transition-colors hover:text-zinc-200"
        aria-label="Log out"
      >
        <LogOut className="h-4 w-4" aria-hidden="true" />
      </button>
    </div>
  );
}
