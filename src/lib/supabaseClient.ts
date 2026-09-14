// src/lib/supabaseClient.ts
import { createClient } from "@supabase/supabase-js";

const url = import.meta.env.VITE_SUPABASE_URL;
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

/**
 * True when Supabase is actually configured. The app still runs (leaderboard,
 * moves, wallet lookup are all public) if it isn't — auth/Pro features just
 * stay disabled rather than crashing the page.
 */
export const isSupabaseConfigured =
  Boolean(url) && Boolean(anonKey) && anonKey !== "PASTE_YOUR_ANON_PUBLIC_KEY_HERE";

/**
 * Single shared browser client. Uses the public anon key (safe to ship) and
 * persists the session in localStorage so a refresh keeps the user signed in.
 */
export const supabase = createClient(url ?? "", anonKey ?? "", {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
  },
});

export interface Profile {
  id: string;
  email: string | null;
  plan: "free" | "pro";
  stripe_customer_id: string | null;
}
