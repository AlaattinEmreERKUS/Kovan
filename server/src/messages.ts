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

const SYNC_LIMIT = 200;

export function messagesAfter(sql: SqlStorage, lastId: number): Message[] {
  return sql
    .exec<{ id: number; author_id: string; content: string; created_at: number }>(
      "SELECT id, author_id, content, created_at FROM messages WHERE id > ? ORDER BY id LIMIT ?",
      lastId, SYNC_LIMIT
    )
    .toArray()
    .map((r) => ({ id: r.id, authorId: r.author_id, content: r.content, createdAt: r.created_at }));
}

/** Emoji dizisi ZWJ ve ton degistiricilerle uzayabilir; 32 kod birimi bol tavan. */
export const MAX_EMOJI = 32;

export function messageExists(sql: SqlStorage, messageId: number): boolean {
  return sql.exec("SELECT 1 FROM messages WHERE id = ?", messageId).toArray().length > 0;
}

export function toggleReaction(
  sql: SqlStorage, messageId: number, userId: string, emoji: string
): string[] {
  const var_mi = sql
    .exec("SELECT 1 FROM reactions WHERE message_id = ? AND user_id = ? AND emoji = ?",
      messageId, userId, emoji)
    .toArray().length > 0;

  if (var_mi) {
    sql.exec("DELETE FROM reactions WHERE message_id = ? AND user_id = ? AND emoji = ?",
      messageId, userId, emoji);
  } else {
    sql.exec("INSERT INTO reactions (message_id, user_id, emoji) VALUES (?, ?, ?)",
      messageId, userId, emoji);
  }

  return sql
    .exec<{ user_id: string }>(
      "SELECT user_id FROM reactions WHERE message_id = ? AND emoji = ? ORDER BY rowid",
      messageId, emoji)
    .toArray()
    .map((r) => r.user_id);
}
