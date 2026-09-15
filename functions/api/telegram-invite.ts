// functions/api/telegram-invite.ts
// Pro-gated VIP Telegram access. The Telegram channel is now a Pro perk, not a
// separate purchase — any signed-in Pro user can mint a single-use invite here.
//
// Returns 403 for non-Pro callers, so a free user can never obtain a link.
//
// Required Pages env (encrypted secrets):
//   TELEGRAM_BOT_TOKEN   bot must be an ADMIN of the channel (invite perms)
//   TELEGRAM_CHAT_ID     the VIP channel id (e.g. -100xxxxxxxxxx)
import { getAuthStatus, type AuthEnv } from "../_lib/auth";
import { createSingleUseInvite } from "../_lib/telegram";

interface Env extends AuthEnv {
  TELEGRAM_BOT_TOKEN?: string;
  TELEGRAM_CHAT_ID?: string;
}

const INVITE_TTL_SECONDS = 900; // 15 min to accept

export const onRequest = async (context: {
  request: Request;
  env: Env;
}): Promise<Response> => {
  const { request, env } = context;
  const headers = {
    "content-type": "application/json",
    "cache-control": "private, no-store",
  };

  const auth = await getAuthStatus(request, env);

  // Hard gate: must be a signed-in Pro user.
  if (!auth.authenticated) {
    return new Response(JSON.stringify({ ok: false, error: "sign_in_required" }), {
      status: 401,
      headers,
    });
  }
  if (!auth.isPro) {
    // Include non-sensitive diagnostics so we can see WHY the server thinks
    // this caller isn't Pro (plan lookup status / value / key used).
    return new Response(
      JSON.stringify({ ok: false, error: "pro_required", debug: auth.debug ?? null }),
      { status: 403, headers },
    );
  }

  if (!env.TELEGRAM_BOT_TOKEN || !env.TELEGRAM_CHAT_ID) {
    return new Response(JSON.stringify({ ok: false, error: "not_configured" }), {
      status: 500,
      headers,
    });
  }

  try {
    const invite = await createSingleUseInvite(
      env.TELEGRAM_BOT_TOKEN,
      env.TELEGRAM_CHAT_ID,
      INVITE_TTL_SECONDS,
    );
    return new Response(
      JSON.stringify({ ok: true, invite, expiresInSeconds: INVITE_TTL_SECONDS }),
      { status: 200, headers },
    );
  } catch (err) {
    return new Response(
      JSON.stringify({ ok: false, error: err instanceof Error ? err.message : "unknown" }),
      { status: 502, headers },
    );
  }
};
