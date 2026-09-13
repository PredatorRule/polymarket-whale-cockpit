// services/vip-access/test/stripe.test.ts
import { describe, it, expect } from "vitest";
import { verifyStripeSignature } from "../src/stripe";

// Build a valid Stripe-style signature header for a payload using Web Crypto,
// then assert the verifier accepts it and rejects tampering.
async function sign(payload: string, secret: string, t: number): Promise<string> {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const mac = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(`${t}.${payload}`));
  const hex = [...new Uint8Array(mac)].map((b) => b.toString(16).padStart(2, "0")).join("");
  return `t=${t},v1=${hex}`;
}

const SECRET = "whsec_test_123";
const PAYLOAD = JSON.stringify({ type: "customer.subscription.deleted", data: { object: { id: "sub_1" } } });

describe("verifyStripeSignature", () => {
  it("accepts a correctly signed, in-tolerance payload", async () => {
    const now = 1_760_000_000;
    const header = await sign(PAYLOAD, SECRET, now);
    expect(await verifyStripeSignature(PAYLOAD, header, SECRET, 300, now)).toBe(true);
  });

  it("rejects a tampered payload", async () => {
    const now = 1_760_000_000;
    const header = await sign(PAYLOAD, SECRET, now);
    expect(await verifyStripeSignature(PAYLOAD + "x", header, SECRET, 300, now)).toBe(false);
  });

  it("rejects the wrong secret", async () => {
    const now = 1_760_000_000;
    const header = await sign(PAYLOAD, SECRET, now);
    expect(await verifyStripeSignature(PAYLOAD, header, "whsec_wrong", 300, now)).toBe(false);
  });

  it("rejects a stale timestamp (replay outside tolerance)", async () => {
    const signedAt = 1_760_000_000;
    const header = await sign(PAYLOAD, SECRET, signedAt);
    const muchLater = signedAt + 10_000;
    expect(await verifyStripeSignature(PAYLOAD, header, SECRET, 300, muchLater)).toBe(false);
  });

  it("rejects a malformed header", async () => {
    expect(await verifyStripeSignature(PAYLOAD, "garbage", SECRET, 300, 1_760_000_000)).toBe(false);
  });
});
