// functions/api/wallet.ts
// On-demand JSON lookup for ANY public Polymarket wallet. Thin wrapper over the
// shared auditWallet() so /api/wallet and the SSR /wallet/[address] page share
// exactly one implementation.
import { auditWallet, isAddress } from "../_lib/wallet";

interface Env {
  WALLET_CACHE_SECONDS?: string;
}

export const onRequest = async (context: {
  request: Request;
  env: Env;
}): Promise<Response> => {
  const { request, env } = context;
  const cacheSeconds = Number(env.WALLET_CACHE_SECONDS ?? "120") || 120;
  const headers: Record<string, string> = {
    "content-type": "application/json",
    "cache-control": `public, max-age=${cacheSeconds}`,
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
    // Keep the historical response shape (`whale`) the frontend expects.
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
      maxDrawdownUsdc: audit.maxDrawdownUsdc,
      activePositionsCount: audit.activePositionsCount,
      openValueUsdc: audit.openValueUsdc,
      positions: audit.positions,
      topBet: audit.topBet,
      lastTradeTs: audit.lastTradeTs,
    };
    return new Response(JSON.stringify({ ok: true, whale }), { status: 200, headers });
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
