// services/whale-alerts/src/telegram.ts

const TELEGRAM_API = "https://api.telegram.org";
const MAX_ATTEMPTS = 4;

export interface TelegramResult {
  ok: boolean;
  status: number;
  error?: string;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Send a Markdown message to a Telegram chat via the official Bot API.
 * Resilient: never throws; retries 429/5xx with exponential backoff and
 * honors Telegram's `retry_after` when present.
 */
export async function sendTelegramMessage(
  botToken: string,
  chatId: string,
  text: string,
): Promise<TelegramResult> {
  const url = `${TELEGRAM_API}/bot${botToken}/sendMessage`;
  const body = {
    chat_id: chatId,
    text,
    parse_mode: "Markdown",
    disable_web_page_preview: true,
  };

  let lastStatus = 0;
  let lastError = "";

  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    try {
      const res = await fetch(url, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body),
      });
      lastStatus = res.status;

      if (res.ok) return { ok: true, status: res.status };

      // Rate limited: respect retry_after, else exponential backoff.
      if (res.status === 429) {
        let retryAfter = 0;
        try {
          const data = (await res.json()) as { parameters?: { retry_after?: number } };
          retryAfter = data.parameters?.retry_after ?? 0;
        } catch {
          retryAfter = 0;
        }
        const waitMs = retryAfter > 0 ? retryAfter * 1000 : 2 ** attempt * 500;
        if (attempt < MAX_ATTEMPTS) {
          await sleep(waitMs);
          continue;
        }
        lastError = "rate_limited";
        break;
      }

      // Transient server error: back off and retry.
      if (res.status >= 500) {
        lastError = `server_${res.status}`;
        if (attempt < MAX_ATTEMPTS) {
          await sleep(2 ** attempt * 500);
          continue;
        }
        break;
      }

      // 4xx (bad token, bad chat, malformed) — not retryable.
      lastError = await res.text().catch(() => `http_${res.status}`);
      break;
    } catch (err) {
      // Network error — retry with backoff.
      lastError = err instanceof Error ? err.message : "network_error";
      if (attempt < MAX_ATTEMPTS) {
        await sleep(2 ** attempt * 500);
        continue;
      }
    }
  }

  return { ok: false, status: lastStatus, error: lastError };
}
