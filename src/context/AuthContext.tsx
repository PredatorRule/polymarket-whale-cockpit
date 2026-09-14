// src/context/AuthContext.tsx
import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import type { Session, User } from "@supabase/supabase-js";
import { supabase, isSupabaseConfigured, type Profile } from "../lib/supabaseClient";

interface AuthState {
  user: User | null;
  session: Session | null;
  profile: Profile | null;
  isPro: boolean;
  loading: boolean;
  configured: boolean;
  loginWithGoogle: () => Promise<void>;
  loginWithOtp: (email: string) => Promise<{ error: string | null }>;
  logout: () => Promise<void>;
  refreshProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthState | null>(null);

async function fetchProfile(userId: string): Promise<Profile | null> {
  const { data, error } = await supabase
    .from("profiles")
    .select("id, email, plan, stripe_customer_id")
    .eq("id", userId)
    .maybeSingle();
  if (error) {
    console.error("profile fetch failed:", error.message);
    return null;
  }
  return (data as Profile) ?? null;
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);

  // Refs so the (mount-only) polling effect reads current values without
  // re-subscribing on every state change.
  const userIdRef = useRef<string | null>(null);
  const isProRef = useRef(false);
  userIdRef.current = user?.id ?? null;
  isProRef.current = profile?.plan === "pro";

  useEffect(() => {
    if (!isSupabaseConfigured) {
      setLoading(false);
      return;
    }

    let active = true;

    // Prime from any persisted session, then subscribe to changes.
    supabase.auth.getSession().then(({ data }) => {
      if (!active) return;
      setSession(data.session);
      setUser(data.session?.user ?? null);
      if (data.session?.user) {
        fetchProfile(data.session.user.id).then((p) => active && setProfile(p));
      }
      setLoading(false);

      // After an OAuth/magic-link redirect, Supabase leaves the token in the
      // URL hash. Once the session is loaded, strip it for a clean address bar.
      if (window.location.hash.includes("access_token")) {
        window.history.replaceState({}, "", window.location.pathname + window.location.search);
      }
    });

    const { data: sub } = supabase.auth.onAuthStateChange((_event, newSession) => {
      setSession(newSession);
      setUser(newSession?.user ?? null);
      if (newSession?.user) {
        void fetchProfile(newSession.user.id).then((p) => active && setProfile(p));
      } else {
        setProfile(null);
      }
    });

    // The plan can flip to 'pro' asynchronously (Stripe webhook, or a manual
    // DB change during testing). Re-fetch the profile so Pro unlocks without a
    // manual reload:
    //  - on tab focus / regained visibility
    //  - and, while signed-in-but-still-free, poll every 15s (auto-stops on Pro)
    const reload = () => {
      supabase.auth.getUser().then(({ data }) => {
        if (active && data.user) void fetchProfile(data.user.id).then((p) => active && setProfile(p));
      });
    };
    const onVisible = () => {
      if (document.visibilityState === "visible") reload();
    };
    document.addEventListener("visibilitychange", onVisible);
    window.addEventListener("focus", reload);

    const poll = setInterval(() => {
      // Cheap safety net: only poll when logged in and not yet Pro.
      if (userIdRef.current && !isProRef.current) reload();
    }, 15000);

    return () => {
      active = false;
      sub.subscription.unsubscribe();
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener("focus", reload);
      clearInterval(poll);
    };
  }, []);

  const loginWithGoogle = async (): Promise<void> => {
    await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: window.location.origin },
    });
  };

  const loginWithOtp = async (email: string): Promise<{ error: string | null }> => {
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: { emailRedirectTo: window.location.origin },
    });
    return { error: error?.message ?? null };
  };

  const logout = async (): Promise<void> => {
    await supabase.auth.signOut();
    setProfile(null);
  };

  const refreshProfile = async (): Promise<void> => {
    if (user) setProfile(await fetchProfile(user.id));
  };

  const value = useMemo<AuthState>(
    () => ({
      user,
      session,
      profile,
      isPro: profile?.plan === "pro",
      loading,
      configured: isSupabaseConfigured,
      loginWithGoogle,
      loginWithOtp,
      logout,
      refreshProfile,
    }),
    [user, session, profile, loading],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

// eslint-disable-next-line react-refresh/only-export-components
export function useAuth(): AuthState {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within an AuthProvider");
  return ctx;
}
