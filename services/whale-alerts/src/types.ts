// services/whale-alerts/src/types.ts

export interface Env {
  // Secrets (set via `wrangler secret put`, never committed).
  TELEGRAM_BOT_TOKEN?: string;
  TELEGRAM_CHAT_ID?: string;
  // Vars (wrangler.toml).
  WATCH_WALLETS?: string;
  MIN_NOTIONAL_USD?: string;
  MAX_ALERTS_PER_RUN?: string;
  LOOKBACK_MINUTES?: string;
  // Public cockpit origin used for the "Audit wallet" deep link in alerts.
  COCKPIT_URL?: string;
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
  conditionId: string; // market id, for grouping scale-ins
  title: string;
  eventUrl: string;
  outcome: "YES" | "NO";
  side: "BUY" | "SELL";
  action: string; // "BOUGHT YES" | "BOUGHT NO" | "SOLD YES" | "SOLD NO"
  priceUsd: number; // 0..1 (volume-weighted when aggregated)
  shares: number;
  notionalUsd: number;
  timestamp: number; // seconds (latest fill when aggregated)
  fillCount: number; // how many raw fills this alert represents (>=1)
}
