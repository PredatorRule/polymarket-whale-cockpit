# Launch Posts — Polymarket Whale Cockpit

Paste-ready copy to seed the first traffic. Lead with the free tool, mention the
Telegram alerts as the optional paid layer — never overstate latency
("within about a minute", not "instant/3s").

Live tool: https://polymarket-whale-cockpit.pages.dev

> **READ FIRST — subreddit self-promo rules.** Many trading subs (notably
> **r/algotrading**) ban self-promotion, product announcements, and link drops
> outright — posting the tool there gets it removed and can get you banned.
> Only post to communities that explicitly allow "I built this" / Show-and-Tell
> content, and always check the sidebar + a mod message first. Reddit works best
> when you're a genuine participant, not a driveby link. The X, Show HN, and
> Indie Hackers channels below are promo-friendly by design.

---

## Reddit — HOW to do it without getting banned

Do **not** cold-drop the link in r/algotrading. Options that comply:

1. **Contribute first, link only when relevant.** Answer real questions in
   Polymarket/prediction-market threads; mention the tool only when it directly
   answers someone, framed as "I built a thing that does exactly this" — never
   as a standalone post.
2. **Promo-tolerant subs only.** r/SideProject, r/webdev's showcase threads,
   and prediction-market-specific subs that allow tools. Check each sidebar.
3. **Value-first post (no link in body).** Share a genuine finding — e.g.
   "I pulled the top 50 Polymarket wallets' win rate vs drawdown, here's what
   surprised me" — with a chart/table. Put the tool link in a comment only if
   asked or if the sub allows it. The insight is the post; the tool is the
   footnote.

**Value-first draft (works where data posts are welcome):**

> **Title:** Top Polymarket wallets: high win rate ≠ smooth ride (win-rate vs drawdown)
>
> I audited the current top wallets from Polymarket's public data. The headline
> PnL hides a lot — several "profitable" wallets carry brutal drawdowns, and a
> few high-win-rate ones are basically coinflips with size. Sharing the win-rate
> vs max-drawdown breakdown because it changed how I read the leaderboard.
> [chart/table] — happy to explain how the numbers are derived.

(Only add the tool link if the sub permits and someone asks.)

---

## X / Twitter (thread)

**1/**
Built a free Polymarket whale tracker 🐋

"Profitable wallet" stops looking magical when you see HOW it got there — so the
leaderboard shows win rate AND max drawdown side by side, plus real PnL, volume,
and open positions. Live feed of every $5k+ trade.

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
