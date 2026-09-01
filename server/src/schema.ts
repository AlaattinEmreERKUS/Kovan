export function ensureSchema(sql: SqlStorage): void {
  sql.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id            TEXT PRIMARY KEY,
      username      TEXT NOT NULL UNIQUE,
      display_name  TEXT NOT NULL,
      password_hash TEXT NOT NULL,
      salt          TEXT NOT NULL,
      created_at    INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS invites (
      code       TEXT PRIMARY KEY,
      created_by TEXT,
      used_by    TEXT,
      used_at    INTEGER
    );

    CREATE TABLE IF NOT EXISTS sessions (
      token_hash TEXT PRIMARY KEY,
      user_id    TEXT NOT NULL,
      created_at INTEGER NOT NULL,
      last_seen  INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS messages (
      id         INTEGER PRIMARY KEY AUTOINCREMENT,
      author_id  TEXT NOT NULL,
      content    TEXT NOT NULL,
      created_at INTEGER NOT NULL,
      edited_at  INTEGER,
      reply_to   INTEGER
    );

    CREATE TABLE IF NOT EXISTS reactions (
      message_id INTEGER NOT NULL,
      user_id    TEXT NOT NULL,
      emoji      TEXT NOT NULL,
      PRIMARY KEY (message_id, user_id, emoji)
    );
  `);
}
