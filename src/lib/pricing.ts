// src/lib/pricing.ts
// Single source of truth for Pro pricing + checkout + perks.

export const PRO_PRICE_LABEL = "€9/mo";
export const PRO_PRICE_AMOUNT = "€9";

// Stripe Checkout link for the €9/mo Pro plan.
export const STRIPE_CHECKOUT_URL = "https://buy.stripe.com/aFabITbtteU23751OG4ko02";

export const PRO_PERKS: string[] = [
  "Zero-delay live whale feed — see $25k+ fills the moment they land (free tier is delayed 10 min)",
  "Advanced wallet analytics — max drawdown, 7-day PnL, open exposure & full position breakdown",
  "Unlimited CSV exports of the leaderboard & any audited wallet",
  "VIP Telegram alerts pushing every large whale fill within ~a minute",
  "Audit any wallet in full — win rate, drawdown and live positions with nothing blurred",
];
