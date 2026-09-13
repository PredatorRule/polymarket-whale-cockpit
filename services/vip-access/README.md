# VIP Access (Cloudflare Worker)

Fully automated, $0-infra gate for the paid VIP Telegram channel. No Whop, no
membership SaaS, no cut taken. It verifies payment against Stripe's API, hands
the buyer a single-use Telegram invite, and automatically removes them when
their subscription ends or a payment fails.

## Flow

1. **Checkout** — set the Stripe Payment Link's success URL to:
   `https://<worker-domain>/join?session_id={CHECKOUT_SESSION_ID}`
   (Stripe substitutes the real session id.)
2. **/join** retrieves the Checkout Session **server-side** and confirms
   `payment_status = paid`. Only then does it mint a **single-use, 15-min**
   Telegram invite (`member_limit: 1`) and show the "Join VIP" button. A leaked
   URL can't verify payment, and a leaked invite dies after one join.
3. **Telegram webhook** (`chat_member`) binds the joining Telegram user to their
   Stripe subscription in KV (`sub2user:<subId> -> <userId>`).
4. **Stripe webhook** — on `customer.subscription.deleted` / `paused` /
   `invoice.payment_failed`, the worker looks up the mapped Telegram user and
   **bans (then unbans)** them, ending access while allowing a future paid
   re-join. Signatures are verified with HMAC-SHA256 + timestamp tolerance.

## Setup

```bash
npm install
wrangler kv namespace create VIP_STATE     # paste id into wrangler.toml
wrangler secret put STRIPE_SECRET_KEY       # sk_live_...
wrangler secret put STRIPE_WEBHOOK_SECRET   # whsec_... (from the webhook endpoint)
wrangler secret put TELEGRAM_BOT_TOKEN      # bot must be channel ADMIN (invite + ban perms)
npm run deploy
```

Then, one-time wiring in the dashboards:

- **Stripe → Payment Link**: success URL `https://<worker>/join?session_id={CHECKOUT_SESSION_ID}`.
- **Stripe → Developers → Webhooks**: add endpoint `https://<worker>/stripe-webhook`,
  events: `customer.subscription.deleted`, `customer.subscription.paused`,
  `invoice.payment_failed`. Copy its signing secret into `STRIPE_WEBHOOK_SECRET`.
- **Telegram**: point the bot's updates at the worker so joins are captured:
  `https://api.telegram.org/bot<TOKEN>/setWebhook?url=https://<worker>/telegram-webhook&allowed_updates=["chat_member","my_chat_member"]`
  The bot must be an **admin** of the channel with invite + ban rights.

## Config (wrangler.toml [vars])

| Var | Meaning |
|-----|---------|
| `TELEGRAM_CHAT_ID` | Numeric channel id (e.g. `-1004479790333`) |
| `COCKPIT_URL` | Fallback link shown on invalid `/join` |

## Test / typecheck / deploy

```bash
npm run test        # Stripe signature verification (accept/tamper/replay/wrong-secret)
npm run typecheck
npm run deploy
```

## Security notes

- Payment is **verified server-side** against Stripe; the client never asserts
  "I paid". Webhook payloads are **signature-verified** before acting.
- Invites are single-use + short-lived, so sharing the success URL or the invite
  doesn't grant extra access.
- Access removal is event-driven from Stripe, so cancellations/failed renewals
  end access without any manual step.

## Limitation

Binding a joiner to their subscription relies on the Telegram `chat_member`
update carrying the `invite_link` used. If a user joins by some other means,
they won't be mapped and can't be auto-removed. For a single gated invite flow
this is the normal path; monitor the channel for anomalies.
