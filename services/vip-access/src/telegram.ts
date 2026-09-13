// services/vip-access/src/telegram.ts
// Telegram Bot API helpers for issuing single-use invites and removing members.

const API = "https://api.telegram.org";

async function call(
  botToken: string,
  method: string,
  body: Record<string, unknown>,
): Promise<Record<string, unknown>> {
  const res = await fetch(`${API}/bot${botToken}/${method}`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
  const data = (await res.json().catch(() => ({}))) as Record<string, unknown>;
  if (!res.ok || data.ok !== true) {
    throw new Error(`telegram ${method} failed: ${res.status} ${JSON.stringify(data)}`);
  }
  return data;
}

/**
 * Create a single-use, short-lived invite link to the channel. member_limit=1
 * means the link dies after one join, so a leaked/forwarded URL can't onboard
 * extra freeloaders.
 */
export async function createSingleUseInvite(
  botToken: string,
  chatId: string,
  expireSeconds = 900,
): Promise<string> {
  const data = await call(botToken, "createChatInviteLink", {
    chat_id: chatId,
    member_limit: 1,
    expire_date: Math.floor(Date.now() / 1000) + expireSeconds,
    name: "VIP checkout",
  });
  const result = data.result as Record<string, unknown> | undefined;
  const link = result?.invite_link;
  if (typeof link !== "string") throw new Error("no invite_link in response");
  return link;
}

/** Kick + unban so the user is removed but can rejoin later if they re-subscribe. */
export async function removeMember(
  botToken: string,
  chatId: string,
  userId: number,
): Promise<void> {
  await call(botToken, "banChatMember", { chat_id: chatId, user_id: userId });
  // Immediately unban so a future paid re-join is possible (ban alone is a
  // permanent block on public channels).
  await call(botToken, "unbanChatMember", {
    chat_id: chatId,
    user_id: userId,
    only_if_banned: true,
  });
}
