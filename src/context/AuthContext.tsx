// src/context/AuthContext.tsx
import {
  createContext,
  useContext,
  useEffect,
  useMemo,
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

    // After returning from the Stripe checkout tab, the plan may have flipped
    // to 'pro' via the webhook. Re-fetch the profile on focus so Pro unlocks
    // without a manual reload.
    const onVisible = () => {
      if (document.visibilityState !== "visible") return;
      supabase.auth.getUser().then(({ data }) => {
        if (active && data.user) void fetchProfile(data.user.id).then((p) => active && setProfile(p));
      });
    };
    document.addEventListener("visibilitychange", onVisible);

    return () => {
      active = false;
      sub.subscription.unsubscribe();
      document.removeEventListener("visibilitychange", onVisible);
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
