// functions/_lib/auth.ts
// Server-side Supabase auth for Cloudflare Pages Functions. Verifies the
// caller's JWT against Supabase and resolves their plan from public.profiles,
// so Pro gating can't be bypassed in the browser.

export interface AuthEnv {
  SUPABASE_URL?: string;
  SUPABASE_SERVICE_ROLE?: string;
  // The public anon key is enough to call /auth/v1/user with a bearer token.
  SUPABASE_ANON_KEY?: string;
}

export interface AuthStatus {
  authenticated: boolean;
  userId: string | null;
  email: string | null;
  isPro: boolean;
}

const ANON: AuthStatus = { authenticated: false, userId: null, email: null, isPro: false };

function bearer(request: Request): string | null {
  const h = request.headers.get("authorization") ?? request.headers.get("Authorization");
  if (!h) return null;
  const m = /^Bearer\s+(.+)$/i.exec(h.trim());
  return m ? m[1] : null;
}

/**
 * Verify the access token and resolve the user's plan.
 * - getUser via Supabase /auth/v1/user (validates the JWT signature/expiry).
 * - plan lookup via REST using the service-role key (bypasses RLS) if present,
 *   otherwise best-effort with the caller's own token (RLS must allow self-read).
 */
export async function getAuthStatus(request: Request, env: AuthEnv): Promise<AuthStatus> {
  const token = bearer(request);
  if (!token || !env.SUPABASE_URL) return ANON;

  const apikey = env.SUPABASE_ANON_KEY ?? env.SUPABASE_SERVICE_ROLE ?? "";
  try {
    const userRes = await fetch(`${env.SUPABASE_URL}/auth/v1/user`, {
      headers: { authorization: `Bearer ${token}`, apikey },
    });
    if (!userRes.ok) return ANON;
    const user = (await userRes.json()) as { id?: string; email?: string };
    if (!user.id) return ANON;

    // Resolve plan. Prefer the service role (authoritative, bypasses RLS).
    const planKey = env.SUPABASE_SERVICE_ROLE ?? apikey;
    const planAuth = env.SUPABASE_SERVICE_ROLE ? `Bearer ${env.SUPABASE_SERVICE_ROLE}` : `Bearer ${token}`;
    let isPro = false;
    try {
      const pRes = await fetch(
        `${env.SUPABASE_URL}/rest/v1/profiles?id=eq.${encodeURIComponent(user.id)}&select=plan`,
        { headers: { apikey: planKey, authorization: planAuth } },
      );
      if (pRes.ok) {
        const rows = (await pRes.json()) as { plan?: string }[];
        isPro = Array.isArray(rows) && rows[0]?.plan === "pro";
      }
    } catch {
      isPro = false;
    }

    return { authenticated: true, userId: user.id, email: user.email ?? null, isPro };
  } catch {
    return ANON;
  }
}
