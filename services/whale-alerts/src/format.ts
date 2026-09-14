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

/** Escape HTML reserved chars for Telegram parse_mode=HTML (robust for titles). */
export function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

/** Size tier label + emoji, so scanning the channel conveys magnitude fast. */
export function sizeTier(notionalUsd: number): { emoji: string; label: string } {
  if (notionalUsd >= 100_000) return { emoji: "\ud83d\udc0b", label: "MEGA WHALE" }; // 🐋
  if (notionalUsd >= 25_000) return { emoji: "\ud83e\udd88", label: "WHALE" }; // 🦈
  return { emoji: "\ud83d\udca6", label: "BIG TRADE" }; // 💦
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
    conditionId: String(raw.conditionId ?? ""),
    title: String(raw.title ?? "Untitled market"),
    eventUrl: eventSlug ? `${POLY_EVENT}${eventSlug}` : `${POLY_PROFILE}${wallet}`,
    outcome,
    side,
    action,
    priceUsd: price,
    shares,
    notionalUsd,
    timestamp,
    fillCount: 1,
  };
}

/**
 * Collapse a scale-in burst into one alert: same wallet + market + side +
 * outcome trades combine into a single WhaleTrade with summed notional/shares,
 * volume-weighted price, latest timestamp, and a fillCount. This is what stops
 * "$9,899 / $9,900 / $9,899" spamming the channel as three near-identical pings.
 */
export function aggregateTrades(trades: WhaleTrade[]): WhaleTrade[] {
  const groups = new Map<string, WhaleTrade[]>();
  for (const t of trades) {
    // Group key intentionally excludes price/size/txn so scale-ins merge.
    const key = `${t.wallet}:${t.conditionId || t.title}:${t.side}:${t.outcome}`;
    const arr = groups.get(key);
    if (arr) arr.push(t);
    else groups.set(key, [t]);
  }

  const out: WhaleTrade[] = [];
  for (const arr of groups.values()) {
    if (arr.length === 1) {
      out.push(arr[0]);
      continue;
    }
    const notionalUsd = arr.reduce((s, t) => s + t.notionalUsd, 0);
    const shares = arr.reduce((s, t) => s + t.shares, 0);
    const latest = arr.reduce((a, b) => (b.timestamp > a.timestamp ? b : a));
    // Volume-weighted average price across the fills.
    const vwap = shares > 0 ? arr.reduce((s, t) => s + t.priceUsd * t.shares, 0) / shares : latest.priceUsd;
    out.push({
      ...latest,
      priceUsd: vwap,
      shares,
      notionalUsd,
      fillCount: arr.length,
    });
  }
  return out;
}

/** Build the Telegram HTML message body for a whale trade. */
export function formatAlert(t: WhaleTrade): string {
  const tier = sizeTier(t.notionalUsd);
  // Directional cue: buys green, sells red; YES/NO shown explicitly.
  const dir = t.side === "SELL" ? "\ud83d\udd34" : "\ud83d\udfe2"; // 🔴 / 🟢
  const profile = `${POLY_PROFILE}${t.wallet}`;

  // When several fills were merged, label the size as an aggregate and note
  // that the price is a volume-weighted average across N fills.
  const sizeLabel =
    t.fillCount > 1
      ? `\ud83d\udcb0 Size: <b>${formatUsd(t.notionalUsd)}</b> <i>(${t.fillCount} fills)</i>`
      : `\ud83d\udcb0 Size: <b>${formatUsd(t.notionalUsd)}</b>`;
  const priceLabel =
    t.fillCount > 1
      ? `\ud83c\udff7 Avg price: ${formatPrice(t.priceUsd)}`
      : `\ud83c\udff7 Price: ${formatPrice(t.priceUsd)}`;

  const lines = [
    `${tier.emoji} <b>${tier.label}</b> · ${dir} <b>${t.action}</b>`,
    "",
    `<b>${escapeHtml(t.title)}</b>`,
    "",
    sizeLabel,
    priceLabel,
    `\ud83d\udc64 Trader: <a href="${profile}">${maskAddress(t.wallet)}</a>`,
  ];
  return lines.join("\n");
}

/**
 * Inline keyboard for an alert: a row driving to the event, and a row driving
 * BACK to our own cockpit wallet page (the growth loop — every alert markets
 * the site). cockpitUrl has no trailing slash requirement.
 */
export function alertKeyboard(t: WhaleTrade, cockpitUrl: string): {
  inline_keyboard: { text: string; url: string }[][];
} {
  const base = cockpitUrl.replace(/\/+$/, "");
  return {
    inline_keyboard: [
      [{ text: "\ud83d\udcc8 View market", url: t.eventUrl }],
      [{ text: "\ud83d\udd0d Audit this wallet", url: `${base}/wallet/${t.wallet}` }],
    ],
  };
}