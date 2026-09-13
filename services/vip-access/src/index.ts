// services/vip-access/src/index.ts
// Fully automated VIP access: verify Stripe payment -> issue a single-use
// Telegram invite -> track who joined via which subscription -> auto-remove on
// cancellation or failed payment. No third-party membership service.
//
// Flow:
//   1. Stripe Payment Link success_url = https://<worker>/join?session_id={CHECKOUT_SESSION_ID}
//   2. /join verifies the session is PAID (server-side Stripe API), mints a
//      single-use invite link, and remembers which subscription that link is for.
//   3. Telegram webhook fires when the user joins via that link; we map
//      subscription -> telegram user id.
//   4. Stripe webhook (subscription deleted / payment failed) -> ban the mapped
//      user so access ends when they stop paying.
import type { Env } from "./types";
import { getCheckoutSession, verifyStripeSignature } from "./stripe";
import { createSingleUseInvite, removeMember } from "./telegram";

const INVITE_TTL_SECONDS = 900; // 15 min to accept the invite
const MAP_TTL_SECONDS = 60 * 60 * 24 * 400; // keep sub->user map well beyond a year

function html(body: string, status = 200): Response {
  return new Response(
    `<!doctype html><html lang="en"><head><meta charset="UTF-8"/>
<meta name="viewport" content="width=device-width, initial-scale=1.0"/>
<title>VIP Access</title>
<style>body{background:#09090b;color:#e4e4e7;font-family:system-ui;margin:0}
.w{max-width:520px;margin:0 auto;padding:80px 24px;text-align:center}
a.btn{display:inline-block;margin-top:20px;background:#06b6d4;color:#06202a;font-weight:700;padding:12px 20px;border-radius:10px;text-decoration:none}
.muted{color:#71717a;font-size:.9rem}</style></head>
<body><div class="w">${body}</div></body></html>`,
    { status, headers: { "content-type": "text/html; charset=utf-8" } },
  );
}

/** GET /join?session_id=... — verify payment and hand back a single-use invite. */
async function handleJoin(req: Request, env: Env): Promise<Response> {
  const cockpit = env.COCKPIT_URL || "https://polymarket-whale-cockpit.pages.dev";
  const sessionId = new URL(req.url).searchParams.get("session_id") ?? "";

  if (!env.STRIPE_SECRET_KEY || !env.TELEGRAM_BOT_TOKEN || !env.TELEGRAM_CHAT_ID) {
    return html(`<h1>Not configured</h1><p class="muted">Access service is not set up yet.</p>`, 500);
  }
  if (!sessionId) {
    return html(
      `<h1>Missing session</h1><p class="muted">Start from checkout to get your access link.</p>
       <a class="btn" href="${cockpit}">Back to the cockpit</a>`,
      400,
    );
  }

  let session;
  try {
    session = await getCheckoutSession(env.STRIPE_SECRET_KEY, sessionId);
  } catch {
    return html(`<h1>Couldn't verify payment</h1><p class="muted">Please try again shortly.</p>`, 502);
  }

  if (!session.paid) {
    return html(
      `<h1>Payment not confirmed</h1><p class="muted">We couldn't confirm this payment. If you just paid, wait a moment and refresh.</p>`,
      402,
    );
  }

  let invite: string;
  try {
    invite = await createSingleUseInvite(env.TELEGRAM_BOT_TOKEN, env.TELEGRAM_CHAT_ID, INVITE_TTL_SECONDS);
  } catch {
    return html(`<h1>Almost there</h1><p class="muted">Couldn't create your invite. Contact support with your email.</p>`, 502);
  }

  // Remember which subscription this invite belongs to, so the Telegram webhook
  // can bind the joining user to the subscription for later removal.
  if (session.subscriptionId) {
    await env.VIP_STATE.put(`invite:${invite}`, session.subscriptionId, {
      expirationTtl: INVITE_TTL_SECONDS + 60,
    });
  }

  return html(
    `<h1>You're in ✅</h1>
     <p>Your payment is confirmed. Tap below to join the VIP Telegram channel.</p>
     <a class="btn" href="${invite}">Join VIP Telegram →</a>
     <p class="muted" style="margin-top:16px">This link works once and expires in 15 minutes.</p>`,
  );
}

/** POST /telegram-webhook — bind a joining user to their subscription. */
async function handleTelegramWebhook(req: Request, env: Env): Promise<Response> {
  const update = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  const cm = (update.chat_member ?? update.my_chat_member) as Record<string, unknown> | undefined;
  if (cm) {
    const inviteLink = (cm.invite_link as Record<string, unknown> | undefined)?.invite_link;
    const newMember = cm.new_chat_member as Record<string, unknown> | undefined;
    const status = newMember?.status;
    const user = newMember?.user as Record<string, unknown> | undefined;
    const userId = user?.id;

    if (typeof inviteLink === "string" && typeof userId === "number" && (status === "member" || status === "restricted")) {
      const subId = await env.VIP_STATE.get(`invite:${inviteLink}`);
      if (subId) {
        // Bidirectional map so a Stripe cancellation can find the user.
        await env.VIP_STATE.put(`sub2user:${subId}`, String(userId), { expirationTtl: MAP_TTL_SECONDS });
        await env.VIP_STATE.delete(`invite:${inviteLink}`);
      }
    }
  }
  // Always 200 so Telegram doesn't retry-storm.
  return new Response("ok");
}

/** POST /stripe-webhook — remove access when a subscription ends or lapses. */
async function handleStripeWebhook(req: Request, env: Env): Promise<Response> {
  if (!env.STRIPE_WEBHOOK_SECRET || !env.TELEGRAM_BOT_TOKEN || !env.TELEGRAM_CHAT_ID) {
    return new Response("not configured", { status: 500 });
  }
  const payload = await req.text();
  const sig = req.headers.get("stripe-signature") ?? "";

  const valid = await verifyStripeSignature(payload, sig, env.STRIPE_WEBHOOK_SECRET);
  if (!valid) return new Response("bad signature", { status: 400 });

  let event: Record<string, unknown>;
  try {
    event = JSON.parse(payload) as Record<string, unknown>;
  } catch {
    return new Response("bad json", { status: 400 });
  }

  const type = String(event.type ?? "");
  const obj = (event.data as Record<string, unknown> | undefined)?.object as
    | Record<string, unknown>
    | undefined;

  // Events that mean "access should end".
  const REVOKE = new Set([
    "customer.subscription.deleted",
    "customer.subscription.paused",
    "invoice.payment_failed",
  ]);

  if (obj && REVOKE.has(type)) {
    // subscription id lives at obj.id for subscription events, obj.subscription for invoice events.
    const subId =
      typeof obj.id === "string" && type.startsWith("customer.subscription")
        ? (obj.id as string)
        : typeof obj.subscription === "string"
          ? (obj.subscription as string)
          : null;

    if (subId) {
      const userIdRaw = await env.VIP_STATE.get(`sub2user:${subId}`);
      if (userIdRaw) {
        const userId = Number(userIdRaw);
        if (Number.isFinite(userId)) {
          try {
            await removeMember(env.TELEGRAM_BOT_TOKEN, env.TELEGRAM_CHAT_ID, userId);
          } catch (e) {
            console.error("removeMember failed:", e);
          }
        }
        await env.VIP_STATE.delete(`sub2user:${subId}`);
      }
    }
  }

  return new Response("ok");
}

export default {
  async fetch(req: Request, env: Env): Promise<Response> {
    const url = new URL(req.url);
    if (req.method === "GET" && url.pathname === "/join") return handleJoin(req, env);
    if (req.method === "POST" && url.pathname === "/telegram-webhook")
      return handleTelegramWebhook(req, env);
    if (req.method === "POST" && url.pathname === "/stripe-webhook")
      return handleStripeWebhook(req, env);
    return new Response("Not found", { status: 404 });
  },
};
