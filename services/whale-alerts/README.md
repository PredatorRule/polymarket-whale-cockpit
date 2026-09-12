# Whale Alerts (Cloudflare Cron Worker)

Scheduled Worker that polls Polymarket's **public** trades API for a watchlist
of whale wallets and pushes formatted alerts to a Telegram channel via the
official Bot API. No private keys, no paid APIs.

## How it works

1. Every 5 minutes (cron), resolve the watchlist: either `WATCH_WALLETS`
   (comma-separated) or the top `TOP_N` wallets from the public leaderboard.
2. Fetch each wallet's recent public trades, keep those within
   `LOOKBACK_MINUTES` and at/above `MIN_NOTIONAL_USD`.
3. For each new trade (deduplicated via KV), send a Telegram `sendMessage`:
   - `parse_mode: Markdown`, `disable_web_page_preview: true`
   - header `🚨 WHALE MOVEMENT DETECTED`, masked wallet linking to the
     Polymarket profile, market title, action (`BOUGHT YES/NO` / `SOLD …`),
     trade size in USD, execution price ($/¢), and a market link.
4. Only mark a trade delivered **after** a successful send, so failures retry.

## Secrets (never commit)

```bash
wrangler secret put TELEGRAM_BOT_TOKEN   # from @BotFather
wrangler secret put TELEGRAM_CHAT_ID     # e.g. -100xxxxxxxxxx
```

For local `wrangler dev`, copy `.env.example` to `.env` (gitignored).

## KV (dedupe state)

Create the namespace once and paste its id into `wrangler.toml`:

```bash
wrangler kv namespace create ALERT_STATE
```

## Config (wrangler.toml [vars])

| Var | Meaning | Default |
|-----|---------|---------|
| `WATCH_WALLETS` | Comma-separated wallets; empty = auto top-N | "" |
| `TOP_N` | Leaderboard wallets to track when watchlist empty | 10 |
| `MIN_NOTIONAL_USD` | Minimum trade size to alert on | 10000 |
| `LOOKBACK_MINUTES` | Window each run scans | 10 |

## Develop / test / deploy

```bash
npm install
npm run test        # formatter + normalizer unit tests
npm run typecheck
npm run dev         # local; GET / to run a scan on demand
npm run deploy      # publish + register cron
```

## Resiliency

- Telegram sends never throw; 429s honor `retry_after`, 5xx/network errors
  use exponential backoff (up to 4 attempts). A failed send is not marked
  delivered, so it retries next run.
- Per-wallet fetch failures are caught and logged; one bad wallet never breaks
  the run.

## Notes

- Alerts describe **observed public trades**, not forward signals. Maker fills
  depend on queue position and are not reproducible by buying later.
- Rotate the bot token via @BotFather if it is ever exposed.
