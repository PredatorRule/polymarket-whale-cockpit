// src/components/SignInModal.tsx
import { useEffect, useState } from "react";
import { X, Mail } from "lucide-react";
import { useAuth } from "../context/AuthContext";

export function SignInModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { loginWithGoogle, loginWithOtp } = useAuth();
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  useEffect(() => {
    if (!open) {
      setSent(false);
      setError(null);
      setEmail("");
    }
  }, [open]);

  if (!open) return null;

  const submitOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) return;
    setBusy(true);
    setError(null);
    const { error: err } = await loginWithOtp(email.trim());
    setBusy(false);
    if (err) setError(err);
    else setSent(true);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" role="dialog" aria-modal="true" aria-label="Sign in">
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onClose} aria-hidden="true" />
      <div className="relative w-full max-w-sm overflow-hidden rounded-2xl border border-zinc-800 bg-surface p-5 shadow-2xl shadow-black/50">
        <button
          type="button"
          onClick={onClose}
          className="absolute right-4 top-4 text-zinc-500 transition-colors hover:text-zinc-200"
          aria-label="Close"
        >
          <X className="h-5 w-5" aria-hidden="true" />
        </button>
        <h2 className="text-lg font-bold tracking-tight text-zinc-50">Sign in</h2>
        <p className="mt-1 text-sm text-zinc-400">Save watchlists and unlock Pro.</p>

        <button
          type="button"
          onClick={() => void loginWithGoogle()}
          className="mt-4 flex w-full items-center justify-center gap-2 rounded-lg border border-zinc-700 bg-zinc-100 px-4 py-2.5 text-sm font-semibold text-zinc-900 transition-colors hover:bg-white"
        >
          <svg className="h-4 w-4" viewBox="0 0 24 24" aria-hidden="true">
            <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z"/>
            <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84A11 11 0 0 0 12 23z"/>
            <path fill="#FBBC05" d="M5.84 14.1a6.6 6.6 0 0 1 0-4.2V7.06H2.18a11 11 0 0 0 0 9.88l3.66-2.84z"/>
            <path fill="#EA4335" d="M12 4.75c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 1.46 14.97.5 12 .5A11 11 0 0 0 2.18 7.06l3.66 2.84C6.71 7.3 9.14 4.75 12 4.75z"/>
          </svg>
          Continue with Google
        </button>

        <div className="my-4 flex items-center gap-3 text-xs text-zinc-600">
          <span className="h-px flex-1 bg-zinc-800" /> or <span className="h-px flex-1 bg-zinc-800" />
        </div>

        {sent ? (
          <div className="rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-300">
            Check your inbox — we sent a magic sign-in link to <b>{email}</b>.
          </div>
        ) : (
          <form onSubmit={submitOtp} className="space-y-2">
            <div className="relative">
              <Mail className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-500" aria-hidden="true" />
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@email.com"
                aria-label="Email for magic link"
                className="w-full rounded-lg border border-zinc-800 bg-zinc-900/70 py-2.5 pl-9 pr-3 text-sm text-zinc-100 outline-none transition placeholder:text-zinc-600 focus:border-zinc-600 focus:ring-1 focus:ring-cyan-500/40"
              />
            </div>
            {error && <p className="text-xs text-rose-400">{error}</p>}
            <button
              type="submit"
              disabled={busy}
              className="w-full rounded-lg bg-cyan-500 px-4 py-2.5 text-sm font-semibold text-zinc-950 transition-colors hover:bg-cyan-400 disabled:opacity-60"
            >
              {busy ? "Sending…" : "Email me a magic link"}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
