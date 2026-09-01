import type { Message, ReactionState } from "@shared/protocol";

const RECENT_LIMIT = 50;

export function recentMessages(sql: SqlStorage): Message[] {
  return sql
    .exec<{ id: number; author_id: string; content: string; created_at: number }>(
      "SELECT id, author_id, content, created_at FROM messages ORDER BY id DESC LIMIT ?",
      RECENT_LIMIT
    )
    .toArray()
    .map((r) => ({ id: r.id, authorId: r.author_id, content: r.content, createdAt: r.created_at }))
    .reverse();
}

export function reactionsFor(sql: SqlStorage, messageIds: number[]): ReactionState[] {
  if (messageIds.length === 0) return [];
  const yerler = messageIds.map(() => "?").join(",");
  const rows = sql
    .exec<{ message_id: number; emoji: string; user_id: string }>(
      `SELECT message_id, emoji, user_id FROM reactions WHERE message_id IN (${yerler})`,
      ...messageIds
    )
    .toArray();

  const grup = new Map<string, ReactionState>();
  for (const r of rows) {
    const anahtar = `${r.message_id}|${r.emoji}`;
    const mevcut = grup.get(anahtar);
    if (mevcut) mevcut.userIds.push(r.user_id);
    else grup.set(anahtar, { messageId: r.message_id, emoji: r.emoji, userIds: [r.user_id] });
  }
  return [...grup.values()];
}

export const MAX_CONTENT = 2000;

export function insertMessage(sql: SqlStorage, authorId: string, content: string): Message {
  const createdAt = Date.now();
  const row = sql
    .exec<{ id: number }>(
      "INSERT INTO messages (author_id, content, created_at) VALUES (?, ?, ?) RETURNING id",
      authorId, content, createdAt
    )
    .toArray()[0];
  return { id: row.id, authorId, content, createdAt };
}
