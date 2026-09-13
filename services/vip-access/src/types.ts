// services/vip-access/src/types.ts

export interface Env {
  // Secrets
  STRIPE_SECRET_KEY?: string;
  STRIPE_WEBHOOK_SECRET?: string;
  TELEGRAM_BOT_TOKEN?: string;
  // Vars
  TELEGRAM_CHAT_ID?: string;
  COCKPIT_URL?: string;
  // KV
  VIP_STATE: KVNamespace;
}
