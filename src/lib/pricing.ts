// src/lib/pricing.ts
// Single source of truth for Pro pricing + checkout + perks.

export const PRO_PRICE_LABEL = "€9/mo";
export const PRO_PRICE_AMOUNT = "€9";

// Stripe Checkout link for the €9/mo Pro plan.
export const STRIPE_CHECKOUT_URL = "https://buy.stripe.com/aFabITbtteU23751OG4ko02";

export const PRO_PERKS: string[] = [
  "Zero-delay live whale feed (free tier is delayed 10 min)",
  "Unlimited CSV exports of the leaderboard & wallets",
  "Advanced wallet analytics — drawdown, PnL breakdown, concentration",
  "VIP Telegram alerts for large fills",
];
