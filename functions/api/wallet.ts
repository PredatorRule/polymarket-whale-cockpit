// functions/api/wallet.ts
// On-demand JSON lookup for ANY public Polymarket wallet. Thin wrapper over the
// shared auditWallet() so /api/wallet and the SSR /wallet/[address] page share
// exactly one implementation.
import { auditWallet, isAddress } from "../_lib/wallet";
import { getAuthStatus, type AuthEnv } from "../_lib/auth";

interface Env extends AuthEnv {
  WALLET_CACHE_SECONDS?: string;
}

export const onRequest = async (context: {
  request: Request;
  env: Env;
}): Promise<Response> => {
  const { request, env } = context;
  const cacheSeconds = Number(env.WALLET_CACHE_SECONDS ?? "120") || 120;

  // Plan-aware: advanced audit metrics are stripped for non-Pro server-side,
  // so the response must not be shared-cached.
  const auth = await getAuthStatus(request, env);
  const headers: Record<string, string> = {
    "content-type": "application/json",
    "cache-control": "private, no-store",
    "access-control-allow-origin": "*",
  };

  const address = (new URL(request.url).searchParams.get("address") ?? "").trim().toLowerCase();
  if (!isAddress(address)) {
    return new Response(JSON.stringify({ ok: false, reason: "invalid_address", whale: null }), {
      status: 200,
      headers,
    });
  }

  try {
    const audit = await auditWallet(address, cacheSeconds);
    if (!audit) {
      return new Response(JSON.stringify({ ok: false, reason: "not_found", whale: null }), {
        status: 200,
        headers,
      });
    }

    // Free tier gets headline stats only. Advanced metrics (drawdown, per-
    // position breakdown, exposure detail) are stripped BEFORE serialization,
    // so they never reach a non-Pro client — the drawer blur is now real.
    const isPro = auth.isPro;
    const whale = {
      address: audit.address,
      name: undefined as string | undefined,
      totalPnl: audit.totalPnl,
      pnl30d: 0,
      pnl7d: 0,
      totalVolume: 0,
      leaderRankAll: 0,
      winRate: audit.winRate,
      wins: audit.wins,
      losses: audit.losses,
      maxDrawdownUsdc: isPro ? audit.maxDrawdownUsdc : 0,
      activePositionsCount: audit.activePositionsCount,
      openValueUsdc: isPro ? audit.openValueUsdc : 0,
      positions: isPro ? audit.positions : audit.positions.slice(0, 1),
      topBet: audit.topBet,
      lastTradeTs: audit.lastTradeTs,
      // Derived strategy insight is Pro-only — stripped for free callers.
      strategy: isPro ? audit.strategy : null,
    };
    return new Response(JSON.stringify({ ok: true, isPro, gated: !isPro, whale }), {
      status: 200,
      headers,
    });
  } catch (err) {
    return new Response(
      JSON.stringify({
        ok: false,
        reason: "fetch_error",
        message: err instanceof Error ? err.message : "unknown",
        whale: null,
      }),
      { status: 200, headers },
    );
  }
};
