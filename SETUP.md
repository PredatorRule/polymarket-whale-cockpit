# Setup — Whale Cockpit SaaS (Supabase Auth + Stripe Pro)

Everything needed to run the freemium features. The public leaderboard, moves
feed, and wallet lookup work without any of this; auth/Pro gating needs it.

## 1. Supabase — database

Run in the Supabase SQL editor (creates the profile row per user + auto-insert
on signup):

```sql
create table if not exists public.profiles (
  id uuid primary key references auth.users on delete cascade,
  email text,
  plan text not null default 'free',
  stripe_customer_id text
);

alter table public.profiles enable row level security;

-- Users may read their own profile (plan writes happen only via service role).
create policy "own profile read" on public.profiles
  for select using (auth.uid() = id);

-- REQUIRED: an RLS policy alone is not enough — the authenticated role also
-- needs table-level SELECT, or PostgREST returns 403 for the browser read
-- (while the SQL editor, running as admin, still sees the row). Without this
-- the app silently treats a Pro user as free.
grant select on public.profiles to authenticated;

create or replace function public.handle_new_user()
returns trigger language plpgsql security definer as $$
begin
  insert into public.profiles (id, email) values (new.id, new.email);
  return new;
end; $$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();
```

## 2. Supabase — auth providers

- Enable **Google** (Authentication → Providers).
- Add the site origin to **URL Configuration → Redirect URLs**:
  `https://polymarket-whale-cockpit.pages.dev`
- Email magic link works out of the box.

## 3. Frontend build env (`.env`, gitignored)

Vite inlines these at build time. Local `.env`:

```
VITE_SUPABASE_URL="https://sffvdwggseglagogehzk.supabase.co"
VITE_SUPABASE_ANON_KEY="sb_publishable_..."
```

Only if you switch to Cloudflare **Git-connected builds** do these also need to
be set in the Pages dashboard (Settings → Environment variables → Production,
plaintext). With prebuilt `dist/` deploys they're already baked in.

## 4. Cloudflare Pages — runtime secrets (Functions)

```bash
npx wrangler pages secret put SUPABASE_URL           --project-name polymarket-whale-cockpit
npx wrangler pages secret put SUPABASE_ANON_KEY      --project-name polymarket-whale-cockpit
npx wrangler pages secret put SUPABASE_SERVICE_ROLE  --project-name polymarket-whale-cockpit
npx wrangler pages secret put STRIPE_WEBHOOK_SECRET  --project-name polymarket-whale-cockpit
# VIP Telegram is now a Pro perk (see /api/telegram-invite):
npx wrangler pages secret put TELEGRAM_BOT_TOKEN     --project-name polymarket-whale-cockpit
npx wrangler pages secret put TELEGRAM_CHAT_ID       --project-name polymarket-whale-cockpit
```

| Secret | Value | Used by |
|--------|-------|---------|
| `SUPABASE_URL` | `https://sffvdwggseglagogehzk.supabase.co` | auth helper, stripe webhook |
| `SUPABASE_ANON_KEY` | `sb_publishable_...` | auth helper (`/auth/v1/user`) |
| `SUPABASE_SERVICE_ROLE` | service-role secret (**rotate if leaked**) | plan lookup, webhook profile writes |
| `STRIPE_WEBHOOK_SECRET` | `whsec_...` from the webhook endpoint | verifies webhook signatures |
| `TELEGRAM_BOT_TOKEN` | bot token; bot must be **channel admin** | `/api/telegram-invite` mints invites |
| `TELEGRAM_CHAT_ID` | VIP channel id (e.g. `-100…`) | `/api/telegram-invite` target channel |

## 5. Stripe

1. €9/mo Payment Link (already wired in `src/lib/pricing.ts`:
   `https://buy.stripe.com/aFabITbtteU23751OG4ko02`).
2. Developers → Webhooks → Add endpoint:
   `https://polymarket-whale-cockpit.pages.dev/api/stripe-webhook`
   events: `checkout.session.completed`, `customer.subscription.deleted`.
   Copy its signing secret → `STRIPE_WEBHOOK_SECRET`.

The checkout link passes `client_reference_id` (Supabase user id) so the webhook
maps the subscription to the right profile and sets `plan = 'pro'`.

## 6. VIP Telegram (bundled into Pro)

Telegram access is a Pro perk — there is **one** €9/mo subscription, not two.
Pro users mint a single-use channel invite from `/api/telegram-invite` (gated:
returns 403 for non-Pro). Requirements:

- A Telegram channel with the bot added as an **admin** (needs invite perms).
- `TELEGRAM_BOT_TOKEN` and `TELEGRAM_CHAT_ID` set as Pages secrets (above).

The standalone `services/vip-access` worker and its separate €9 Payment Link are
now superseded by this in-app flow and can be retired.

## Security model

- Pro gating is enforced **server-side**: `/api/moves` strips fresh trades and
  `/api/wallet` strips advanced metrics for non-Pro *before* serialization;
  `/api/export-csv` returns 403. Client can't bypass via devtools.
- Plan-aware responses are `private, no-store` so a Pro response is never
  shared-cached to a free user.
- Service-role key is server-only (Pages secret), never shipped to the browser.
