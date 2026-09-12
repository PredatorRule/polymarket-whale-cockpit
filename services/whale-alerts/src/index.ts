// services/whale-alerts/src/index.ts
import type { Env, WhaleTrade } from "./types";
import { fetchTopWallets, fetchRecentTrades } from "./feed";
import { formatAlert } from "./format";
import { sendTelegramMessage } from "./telegram";

const DEDUPE_TTL_SECONDS = 60 * 60 * 24 * 3; // remember delivered alerts for 3 days

function parseWallets(csv: string | undefined): string[] {
  return (csv ?? "")
    .split(",")
    .map((w) => w.trim().toLowerCase())
    .filter((w) => /^0x[0-9a-f]{40}$/.test(w));
}

async function resolveWatchlist(env: Env): Promise<string[]> {
  const explicit = parseWallets(env.WATCH_WALLETS);
  if (explicit.length > 0) return explicit;
  const topN = Math.min(Math.max(Number(env.TOP_N ?? "10") || 10, 1), 50);
  return fetchTopWallets(topN);
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

  const wallets = await resolveWatchlist(env);
  if (wallets.length === 0) {
    console.error("No wallets to monitor.");
    return { scanned: 0, alerts: 0 };
  }

  // Gather candidate trades across all wallets.
  const perWallet = await Promise.all(
    wallets.map((w) =>
      fetchRecentTrades(w, sinceTs, minNotional).catch((e) => {
        console.error(`trades fetch failed for ${w}:`, e);
        return [] as WhaleTrade[];
      }),
    ),
  );
  const candidates = perWallet.flat().sort((a, b) => a.timestamp - b.timestamp);

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

export default {
  async scheduled(_event: ScheduledEvent, env: Env, ctx: ExecutionContext): Promise<void> {
    ctx.waitUntil(
      runAlerts(env).then((r) =>
        console.log(`whale-alerts: scanned ${r.scanned}, sent ${r.alerts}`),
      ),
    );
  },

  // Manual trigger for testing: GET the worker URL to run a scan on demand.
  async fetch(_req: Request, env: Env): Promise<Response> {
    const result = await runAlerts(env);
    return new Response(JSON.stringify(result), {
      headers: { "content-type": "application/json" },
    });
  },
};
