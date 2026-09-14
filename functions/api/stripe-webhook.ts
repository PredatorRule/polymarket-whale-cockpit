// functions/api/stripe-webhook.ts
// Stripe webhook -> Supabase profile sync, running on Cloudflare Pages.
//
// - checkout.session.completed  -> set plan='pro' + save stripe_customer_id
// - customer.subscription.deleted -> revert plan='free'
//
// Uses the Supabase SERVICE ROLE key (server-only, bypasses RLS) via the REST
// API — no SDK bundling needed. Verifies the Stripe signature with Web Crypto
// before trusting any payload.
//
// Required Pages env (encrypted secrets, NEVER committed):
//   STRIPE_WEBHOOK_SECRET   whsec_...
//   SUPABASE_URL            https://<project>.supabase.co
//   SUPABASE_SERVICE_ROLE   sb_secret_...  (service role / secret key)

interface Env {
  STRIPE_WEBHOOK_SECRET?: string;
  SUPABASE_URL?: string;
  SUPABASE_SERVICE_ROLE?: string;
}

type Json = Record<string, unknown>;

const enc = new TextEncoder();

function hexToBytes(hex: string): Uint8Array {
  const out = new Uint8Array(hex.length / 2);
  for (let i = 0; i < out.length; i++) out[i] = parseInt(hex.substr(i * 2, 2), 16);
  return out;
}
function timingSafeEqual(a: Uint8Array, b: Uint8Array): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a[i] ^ b[i];
  return diff === 0;
}

/** Verify Stripe's `Stripe-Signature` header against the raw body. */
async function verifySignature(
  payload: string,
  sigHeader: string,
  secret: string,
  toleranceSeconds = 300,
  now = Math.floor(Date.now() / 1000),
): Promise<boolean> {
  const parts = Object.fromEntries(
    sigHeader.split(",").map((kv) => {
      const i = kv.indexOf("=");
      return [kv.slice(0, i).trim(), kv.slice(i + 1).trim()];
    }),
  ) as Record<string, string>;
  const t = Number(parts.t);
  const v1 = parts.v1;
  if (!t || !v1) return false;
  if (Math.abs(now - t) > toleranceSeconds) return false;

  const key = await crypto.subtle.importKey(
    "raw",
    enc.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const mac = await crypto.subtle.sign("HMAC", key, enc.encode(`${t}.${payload}`));
  try {
    return timingSafeEqual(new Uint8Array(mac), hexToBytes(v1));
  } catch {
    return false;
  }
}

/** PATCH public.profiles via Supabase REST using the service-role key. */
async function updateProfile(
  env: Env,
  match: { column: "id" | "stripe_customer_id"; value: string },
  patch: Json,
): Promise<boolean> {
  const url = `${env.SUPABASE_URL}/rest/v1/profiles?${match.column}=eq.${encodeURIComponent(match.value)}`;
  const res = await fetch(url, {
    method: "PATCH",
    headers: {
      apikey: env.SUPABASE_SERVICE_ROLE ?? "",
      authorization: `Bearer ${env.SUPABASE_SERVICE_ROLE ?? ""}`,
      "content-type": "application/json",
      prefer: "return=minimal",
    },
    body: JSON.stringify(patch),
  });
  if (!res.ok) {
    console.error(`supabase profile update failed: ${res.status} ${await res.text().catch(() => "")}`);
    return false;
  }
  return true;
}

export const onRequest = async (context: { request: Request; env: Env }): Promise<Response> => {
  const { request, env } = context;

  if (!env.STRIPE_WEBHOOK_SECRET || !env.SUPABASE_URL || !env.SUPABASE_SERVICE_ROLE) {
    return new Response("not configured", { status: 500 });
  }

  const payload = await request.text();
  const sig = request.headers.get("stripe-signature") ?? "";
  if (!(await verifySignature(payload, sig, env.STRIPE_WEBHOOK_SECRET))) {
    return new Response("bad signature", { status: 400 });
  }

  let event: Json;
  try {
    event = JSON.parse(payload) as Json;
  } catch {
    return new Response("bad json", { status: 400 });
  }

  const type = String(event.type ?? "");
  const obj = (event.data as Json | undefined)?.object as Json | undefined;
  if (!obj) return new Response("ok");

  try {
    if (type === "checkout.session.completed") {
      // Prefer the Supabase user id we passed at checkout; fall back to email.
      const userId =
        typeof obj.client_reference_id === "string" ? obj.client_reference_id : "";
      const customerId = typeof obj.customer === "string" ? obj.customer : "";
      const email =
        ((obj.customer_details as Json | undefined)?.email as string | undefined) ??
        (typeof obj.customer_email === "string" ? obj.customer_email : "");

      const patch: Json = { plan: "pro" };
      if (customerId) patch.stripe_customer_id = customerId;

      let ok = false;
      if (userId) ok = await updateProfile(env, { column: "id", value: userId }, patch);
      // Fallback: match by email if no client_reference_id was set.
      if (!ok && email) {
        const url = `${env.SUPABASE_URL}/rest/v1/profiles?email=eq.${encodeURIComponent(email)}`;
        const res = await fetch(url, {
          method: "PATCH",
          headers: {
            apikey: env.SUPABASE_SERVICE_ROLE,
            authorization: `Bearer ${env.SUPABASE_SERVICE_ROLE}`,
            "content-type": "application/json",
            prefer: "return=minimal",
          },
          body: JSON.stringify(patch),
        });
        ok = res.ok;
      }
      if (!ok) console.error("checkout.session.completed: could not map to a profile");
    } else if (type === "customer.subscription.deleted") {
      const customerId = typeof obj.customer === "string" ? obj.customer : "";
      if (customerId) {
        await updateProfile(env, { column: "stripe_customer_id", value: customerId }, { plan: "free" });
      }
    }
  } catch (e) {
    console.error("webhook handler error:", e);
    // Still 200 so Stripe doesn't retry-storm a non-signature error.
  }

  return new Response("ok");
};
