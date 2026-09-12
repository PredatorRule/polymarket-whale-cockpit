// services/whale-alerts/src/index.ts
import type { Env, WhaleTrade } from "./types";
import { fetchRecentTrades, fetchGlobalWhaleTrades } from "./feed";
import { formatAlert } from "./format";
import { sendTelegramMessage } from "./telegram";

const DEDUPE_TTL_SECONDS = 60 * 60 * 24 * 3; // remember delivered alerts for 3 days

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
  candidates = candidates.sort((a, b) => a.timestamp - b.timestamp);

  let alerts = 0;
  for (const trade of candidates) {
    const key = `sent:${trade.id}`;
    // Skip if we've already delivered this exact trade.
    const seen = await env.ALERT_STATE.get(key);
    if (seen) continue;

    const result = await sendTelegramMessage(
      env.TELEGRAM_BOT_TOKEN,
      env.TELEGRAM_CHAT_ID,
      formatAlert(trade),
    );

    if (result.ok) {
      // Only mark delivered on success, so a failed send retries next run.
      await env.ALERT_STATE.put(key, "1", { expirationTtl: DEDUPE_TTL_SECONDS });
      alerts++;
    } else {
      console.error(`telegram send failed (${result.status}): ${result.error}`);
    }
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
