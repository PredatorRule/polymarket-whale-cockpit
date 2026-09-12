// services/whale-alerts/src/format.ts
import type { RawTrade, WhaleTrade } from "./types";

const POLY_PROFILE = "https://polymarket.com/profile/";
const POLY_EVENT = "https://polymarket.com/event/";

function num(v: unknown, d = 0): number {
  const n = typeof v === "string" ? Number(v) : v;
  return typeof n === "number" && Number.isFinite(n) ? n : d;
}
function int(v: unknown, d = 0): number {
  return Math.trunc(num(v, d));
}

/** Mask an address: 0x204f...5e14 */
export function maskAddress(addr: string): string {
  if (addr.length <= 12) return addr;
  return `${addr.slice(0, 6)}...${addr.slice(-4)}`;
}

/** USD with thousands separators, no decimals: $150,000 */
export function formatUsd(value: number): string {
  return `$${Math.round(value).toLocaleString("en-US")}`;
}

/** Share price shown as dollars and cents: $0.62 (62¢) */
export function formatPrice(price: number): string {
  const cents = Math.round(price * 100);
  return `$${price.toFixed(2)} (${cents}\u00a2)`;
}

/** Escape Telegram Markdown (legacy) reserved characters in free text. */
export function escapeMarkdown(text: string): string {
  return text.replace(/([_*`\[])/g, "\\$1");
}

/** Normalize a raw public trade into a WhaleTrade, or null if unusable. */
export function normalizeTrade(raw: RawTrade): WhaleTrade | null {
  const wallet = String(raw.proxyWallet ?? "").toLowerCase();
  const price = num(raw.price);
  const shares = num(raw.size);
  if (!wallet || price <= 0 || shares <= 0) return null;

  const side = String(raw.side ?? "").toUpperCase() === "SELL" ? "SELL" : "BUY";
  const outcome = String(raw.outcome ?? "YES").toUpperCase() === "NO" ? "NO" : "YES";
  const notionalUsd = price * shares;
  const timestamp = int(raw.timestamp);
  const txn = String(raw.transactionHash ?? "").toLowerCase();
  const eventSlug = String(raw.eventSlug ?? raw.slug ?? "");

  const action = side === "SELL" ? `SOLD ${outcome}` : `BOUGHT ${outcome}`;

  return {
    // Stable dedupe key: txn + asset side + rounded price/size + ts.
    id: `${txn}:${outcome}:${side}:${price.toFixed(4)}:${shares.toFixed(2)}:${timestamp}`,
    wallet,
    title: String(raw.title ?? "Untitled market"),
    eventUrl: eventSlug ? `${POLY_EVENT}${eventSlug}` : `${POLY_PROFILE}${wallet}`,
    outcome,
    side,
    action,
    priceUsd: price,
    shares,
    notionalUsd,
    timestamp,
  };
}

/** Build the Telegram Markdown message body for a whale trade. */
export function formatAlert(t: WhaleTrade): string {
  const profile = `${POLY_PROFILE}${t.wallet}`;
  const lines = [
    "\ud83d\udea8 *WHALE MOVEMENT DETECTED*",
    "",
    `*Trader:* [${maskAddress(t.wallet)}](${profile})`,
    `*Market:* ${escapeMarkdown(t.title)}`,
    `*Action:* ${t.action}`,
    `*Trade Size:* ${formatUsd(t.notionalUsd)}`,
    `*Price:* ${formatPrice(t.priceUsd)}`,
    "",
    `[View market \u2197](${t.eventUrl})`,
  ];
  return lines.join("\n");
}
