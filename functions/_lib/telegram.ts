// functions/_lib/telegram.ts
// Minimal Telegram Bot API helper for minting single-use channel invites.
// Shared by the Pro-gated /api/telegram-invite endpoint.

const API = "https://api.telegram.org";

/**
 * Create a single-use, short-lived invite link to the VIP channel.
 * member_limit=1 means the link dies after one join, so a leaked/forwarded URL
 * can't onboard extra freeloaders.
 */
export async function createSingleUseInvite(
  botToken: string,
  chatId: string,
  expireSeconds = 900,
): Promise<string> {
  const res = await fetch(`${API}/bot${botToken}/createChatInviteLink`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      chat_id: chatId,
      member_limit: 1,
      expire_date: Math.floor(Date.now() / 1000) + expireSeconds,
      name: "Pro VIP",
    }),
  });
  const data = (await res.json().catch(() => ({}))) as {
    ok?: boolean;
    result?: { invite_link?: string };
  };
  if (!res.ok || data.ok !== true) {
    throw new Error(`telegram createChatInviteLink failed: ${res.status}`);
  }
  const link = data.result?.invite_link;
  if (typeof link !== "string") throw new Error("no invite_link in response");
  return link;
}
