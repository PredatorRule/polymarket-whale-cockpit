// services/vip-access/src/stripe.ts
// Minimal Stripe REST helpers + webhook signature verification. We avoid the
// stripe SDK (heavy, Node-oriented) and use fetch + Web Crypto, which run
// natively on Workers.

const STRIPE_API = "https://api.stripe.com/v1";

async function stripeGet(secretKey: string, path: string): Promise<Record<string, unknown>> {
  const res = await fetch(`${STRIPE_API}${path}`, {
    headers: { authorization: `Bearer ${secretKey}` },
  });
  if (!res.ok) throw new Error(`stripe ${path} -> ${res.status}`);
  return (await res.json()) as Record<string, unknown>;
}

/** Retrieve a Checkout Session and confirm it is actually paid. */
export async function getCheckoutSession(
  secretKey: string,
  sessionId: string,
): Promise<{
  paid: boolean;
  subscriptionId: string | null;
  customerId: string | null;
}> {
  const s = await stripeGet(secretKey, `/checkout/sessions/${encodeURIComponent(sessionId)}`);
  const paid = s.payment_status === "paid" || s.status === "complete";
  const subscriptionId = typeof s.subscription === "string" ? s.subscription : null;
  const customerId = typeof s.customer === "string" ? s.customer : null;
  return { paid, subscriptionId, customerId };
}

const enc = new TextEncoder();

function hexToBytes(hex: string): Uint8Array {
  const out = new Uint8Array(hex.length / 2);
  for (let i = 0; i < out.length; i++) out[i] = parseInt(hex.substr(i * 2, 2), 16);
  return out;
}

/** Constant-time comparison to avoid timing leaks on signature checks. */
function timingSafeEqual(a: Uint8Array, b: Uint8Array): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a[i] ^ b[i];
  return diff === 0;
}

/**
 * Verify a Stripe webhook signature (the `Stripe-Signature` header) against the
 * raw request body, per Stripe's scheme: HMAC-SHA256 of `${t}.${payload}` with
 * the endpoint secret, compared to one of the v1 signatures, within tolerance.
 */
export async function verifyStripeSignature(
  payload: string,
  sigHeader: string,
  webhookSecret: string,
  toleranceSeconds = 300,
  nowSeconds: number = Math.floor(Date.now() / 1000),
): Promise<boolean> {
  const parts = Object.fromEntries(
    sigHeader.split(",").map((kv) => {
      const idx = kv.indexOf("=");
      return [kv.slice(0, idx).trim(), kv.slice(idx + 1).trim()];
    }),
  ) as Record<string, string>;

  const t = Number(parts.t);
  const v1 = parts.v1;
  if (!t || !v1) return false;
  if (Math.abs(nowSeconds - t) > toleranceSeconds) return false;

  const key = await crypto.subtle.importKey(
    "raw",
    enc.encode(webhookSecret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const mac = await crypto.subtle.sign("HMAC", key, enc.encode(`${t}.${payload}`));
  const expected = new Uint8Array(mac);

  let provided: Uint8Array;
  try {
    provided = hexToBytes(v1);
  } catch {
    return false;
  }
  return timingSafeEqual(expected, provided);
}
