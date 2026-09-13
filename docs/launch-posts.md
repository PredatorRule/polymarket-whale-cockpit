# Launch Posts — Polymarket Whale Cockpit

Paste-ready copy to seed the first traffic. Post once per channel; the SEO +
Apify Store discovery then compounds. Lead with the free tool, mention the
Telegram alerts as the optional paid layer — never overstate latency
("within about a minute", not "instant/3s").

Live tool: https://polymarket-whale-cockpit.pages.dev

---

## Reddit — r/algotrading

**Title:** I built a free live Polymarket whale tracker (top wallets' PnL, win rate, open positions) — 100% public data, no login

**Body:**
I kept wanting to see which Polymarket wallets are actually profitable and what
they're holding right now, so I built a free dashboard for it.

- Live leaderboard of top wallets: real PnL, win rate, drawdown, open positions
- A live feed of large trades ($5k+) across the whole platform, auto-refreshing
- Paste any 0x address to audit it (your own wallet, or anyone's)
- Everything is derived from Polymarket's public APIs — no login, no wallet connect

It's fully client-side / static-hosted, so it costs me nothing to run. Built the
matching + fee logic myself; happy to talk through how the PnL/win-rate numbers
are computed if anyone's interested.

Link: https://polymarket-whale-cockpit.pages.dev

Not financial advice — a wallet's past PnL doesn't predict its next trade, and
maker fills aren't reproducible by copying late. Treat it as research.

---

## Reddit — r/sportsbook / prediction-market subs

**Title:** Free tool: track the biggest Polymarket wallets and their live moves

**Body:**
Most of the top Polymarket volume right now is actually sports markets. I made a
free tracker that shows the most profitable wallets, their win rates, and a live
feed of large trades as they happen. You can also paste any wallet to audit it.

https://polymarket-whale-cockpit.pages.dev

Public data only, no signup. Feedback welcome.

---

## X / Twitter (thread)

**1/**
Built a free Polymarket whale tracker 🐋

Live leaderboard of the most profitable wallets — real PnL, win rate, drawdown,
and open positions. Plus a live feed of every $5k+ trade.

No login. Public data. 👇
https://polymarket-whale-cockpit.pages.dev

**2/**
Paste any 0x wallet to audit it instantly — your own, or that "profitable
trader" someone's shilling. See their real win rate and what they're actually
holding.

**3/**
Optional: a Telegram channel that pushes large whale fills within ~a minute of
them hitting the chain, so you don't have to watch the board all day.

Everything else is free. Not financial advice.

---

## Indie Hackers / Show HN style

**Title:** Show: Free Polymarket whale tracker (client-side, $0 to run)

**Body:**
A live leaderboard + wallet auditor for Polymarket, built entirely on public
APIs and static hosting (Cloudflare Pages + Functions), so running cost is
basically zero.

Features: top-wallet leaderboard (PnL / win rate / drawdown / positions), a
live large-trade feed, any-wallet lookup, per-wallet SSR pages for sharing, and
an optional paid Telegram alert channel for large fills.

Stack: React + Vite + TS, Cloudflare Pages Functions for the SSR/API layer, a
tiny cron Worker for the alerts. No database.

Link: https://polymarket-whale-cockpit.pages.dev
Would love feedback on the UX and the data accuracy.

---

## Apify cross-promo (actor READMEs / listing)

Add to both actor listings:

> Prefer a UI? The free **Polymarket Whale Cockpit** shows the top wallets'
> live PnL, win rate, and positions from the same public data →
> https://polymarket-whale-cockpit.pages.dev

---

## Honesty guardrails (keep every post truthful)

- Alert latency: "within about a minute", never "instant" or "3 seconds".
- Never imply endorsement by Polymarket — it's an independent tool.
- Always include the not-financial-advice / past-performance caveat.
- Don't claim copy-trading works; frame wallets as research leads.
