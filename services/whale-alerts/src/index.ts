// services/whale-alerts/src/index.ts
import type { Env, WhaleTrade } from "./types";
import { fetchRecentTrades, fetchGlobalWhaleTrades } from "./feed";
import { formatAlert, alertKeyboard } from "./format";
import { sendTelegramMessage } from "./telegram";

const DEFAULT_COCKPIT = "https://polymarket-whale-cockpit.pages.dev";

// Single high-water-mark key: the newest trade timestamp we've alerted on.
// One get + one put per run keeps us far under the KV free-tier 1000 puts/day
// (vs the old one-put-per-trade design that blew the limit).
const HIGH_WATER_KEY = "alerted:newest_ts";

function parseWallets(csv: string | undefined): string[] {
  return (csv ?? "")
    .split(",")
    .map((w) => w.trim().toLowerCase())
    .filter((w) => /^0x[0-9a-f]{40}$/.test(w));
}

/** Core scan: returns how many alerts were dispatched. */
export async function runAlerts(env: Env): Promise<{ scanned: number; alerts: number }> {
  if (!env.TELEGRAM_BOT_TOKEN || !env.TELEGRAM_CHAT_ID) {
    console.error("Telegram secrets not configured; skipping dispatch.");
    return { scanned: 0, alerts: 0 };
  }

  const minNotional = Number(env.MIN_NOTIONAL_USD ?? "10000") || 10000;
  const lookbackMin = Number(env.LOOKBACK_MINUTES ?? "10") || 10;
  const sinceTs = Math.floor(Date.now() / 1000) - lookbackMin * 60;

  // If specific wallets are set, monitor those; otherwise track GLOBAL large
  // trades across the whole platform (the correct "whale movement" feed —
  // all-time PnL leaders are frequently dormant).
  const explicit = parseWallets(env.WATCH_WALLETS);
  let candidates: WhaleTrade[];
  if (explicit.length > 0) {
    const perWallet = await Promise.all(
      explicit.map((w) =>
        fetchRecentTrades(w, sinceTs, minNotional).catch((e) => {
          console.error(`trades fetch failed for ${w}:`, e);
          return [] as WhaleTrade[];
        }),
      ),
    );
    candidates = perWallet.flat();
  } else {
    candidates = await fetchGlobalWhaleTrades(sinceTs, minNotional).catch((e) => {
      console.error("global whale trades fetch failed:", e);
      return [] as WhaleTrade[];
    });
  }
  // Dedupe via a single high-water-mark timestamp (ONE get + ONE put per run),
  // instead of one KV key per trade. Only alert trades strictly newer than the
  // last one we delivered.
  const hwmRaw = await env.ALERT_STATE.get(HIGH_WATER_KEY);
  const highWaterTs = hwmRaw ? Number(hwmRaw) || 0 : 0;

  // Oldest -> newest so we deliver in chronological order and advance the HWM
  // monotonically.
  const fresh = candidates
    .filter((t) => t.timestamp > highWaterTs)
    .sort((a, b) => a.timestamp - b.timestamp);

  // On the very first run (no HWM yet) don't blast historical trades: seed the
  // watermark to the newest seen and send nothing this run.
  if (highWaterTs === 0) {
    const newest = candidates.reduce((m, t) => Math.max(m, t.timestamp), 0);
    if (newest > 0) await env.ALERT_STATE.put(HIGH_WATER_KEY, String(newest));
    return { scanned: candidates.length, alerts: 0 };
  }

  // Cap sends per run to stay under Telegram's per-channel rate limit
  // (~20 msg/min) and avoid a burst.
  const maxPerRun = Math.min(Math.max(Number(env.MAX_ALERTS_PER_RUN ?? "8") || 8, 1), 20);
  const toSend = fresh.slice(0, maxPerRun);
  const cockpitUrl = env.COCKPIT_URL || DEFAULT_COCKPIT;

  let alerts = 0;
  let newHighWater = highWaterTs;
  for (const trade of toSend) {
    const result = await sendTelegramMessage(
      env.TELEGRAM_BOT_TOKEN,
      env.TELEGRAM_CHAT_ID,
      formatAlert(trade),
      alertKeyboard(trade, cockpitUrl),
    );
    if (result.ok) {
      alerts++;
      // Advance HWM only across successfully sent trades, so a failed send is
      // retried next run rather than skipped.
      if (trade.timestamp > newHighWater) newHighWater = trade.timestamp;
    } else {
      console.error(`telegram send failed (${result.status}): ${result.error}`);
      break; // stop on first failure; HWM stays at last good, rest retries next run
    }
  }

  // Single put per run (only if we advanced).
  if (newHighWater > highWaterTs) {
    await env.ALERT_STATE.put(HIGH_WATER_KEY, String(newHighWater));
  }

  return { scanned: candidates.length, alerts };
}

/** Non-dispatching diagnostic: shows what the global whale feed returns. */
async function debugScan(env: Env): Promise<Record<string, unknown>> {
  const minNotional = Number(env.MIN_NOTIONAL_USD ?? "5000") || 5000;
  const lookbackMin = Number(env.LOOKBACK_MINUTES ?? "30") || 30;
  const sinceTs = Math.floor(Date.now() / 1000) - lookbackMin * 60;
  const explicit = parseWallets(env.WATCH_WALLETS);

  const global = await fetchGlobalWhaleTrades(sinceTs, minNotional).catch(() => []);
  const sample = global
    .slice(0, 5)
    .map((t) => ({ wallet: t.wallet, action: t.action, notionalUsd: Math.round(t.notionalUsd), title: t.title, ageMin: Math.round(Date.now() / 1000 - t.timestamp) / 60 }));

  return {
    secretsConfigured: Boolean(env.TELEGRAM_BOT_TOKEN && env.TELEGRAM_CHAT_ID),
    mode: explicit.length > 0 ? "watchlist" : "global",
    watchlistSize: explicit.length,
    minNotionalUsd: minNotional,
    lookbackMinutes: lookbackMin,
    nowTs: Math.floor(Date.now() / 1000),
    sinceTs,
    globalQualified: global.length,
    sample,
  };
}

export default {
  async scheduled(_event: ScheduledEvent, env: Env, ctx: ExecutionContext): Promise<void> {
    ctx.waitUntil(
      runAlerts(env).then((r) =>
        console.log(`whale-alerts: scanned ${r.scanned}, sent ${r.alerts}`),
      ),
    );
  },

  // Manual trigger for testing: GET the worker URL to run a scan on demand.
  // Add ?debug=1 to see the resolved watchlist + raw candidate counts (no
  // Telegram dispatch), which helps diagnose an empty feed vs a quiet window.
  async fetch(req: Request, env: Env): Promise<Response> {
    const url = new URL(req.url);
    if (url.searchParams.get("debug") === "1") {
      const diag = await debugScan(env);
      return new Response(JSON.stringify(diag, null, 2), {
        headers: { "content-type": "application/json" },
      });
    }
    const result = await runAlerts(env);
    return new Response(JSON.stringify(result), {
      headers: { "content-type": "application/json" },
    });
  },
};
