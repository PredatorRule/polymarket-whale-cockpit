// services/whale-alerts/src/types.ts

export interface Env {
  // Secrets (set via `wrangler secret put`, never committed).
  TELEGRAM_BOT_TOKEN?: string;
  TELEGRAM_CHAT_ID?: string;
  // Vars (wrangler.toml).
  WATCH_WALLETS?: string;
  TOP_N?: string;
  MIN_NOTIONAL_USD?: string;
  LOOKBACK_MINUTES?: string;
  // KV binding for dedupe state.
  ALERT_STATE: KVNamespace;
}

/** A public Polymarket trade row (fields we rely on). */
export interface RawTrade {
  transactionHash?: string;
  proxyWallet?: string;
  title?: string;
  slug?: string;
  eventSlug?: string;
  outcome?: string;
  side?: string; // BUY | SELL
  price?: number | string;
  size?: number | string;
  timestamp?: number | string;
  conditionId?: string;
}

/** Normalized trade ready for alerting. */
export interface WhaleTrade {
  id: string; // dedupe key
  wallet: string;
  title: string;
  eventUrl: string;
  outcome: "YES" | "NO";
  side: "BUY" | "SELL";
  action: string; // "BOUGHT YES" | "BOUGHT NO" | "SOLD YES" | "SOLD NO"
  priceUsd: number; // 0..1
  shares: number;
  notionalUsd: number;
  timestamp: number; // seconds
}
