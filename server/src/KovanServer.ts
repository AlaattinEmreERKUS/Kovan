import { ensureSchema } from "./schema";
import { hashPassword, hashToken, newSalt, newSessionToken, timingSafeEqual } from "./auth";
import type { User } from "@shared/protocol";

interface UserRow extends Record<string, SqlStorageValue> {
  id: string;
  username: string;
  display_name: string;
  password_hash: string;
  salt: string;
}

export class KovanServer implements DurableObject {
  private sql: SqlStorage;

  constructor(private ctx: DurableObjectState, private env: unknown) {
    this.sql = ctx.storage.sql;
    ensureSchema(this.sql);
  }

  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);

    if (request.method === "POST" && url.pathname === "/api/register") {
      return this.register(request);
    }
    if (request.method === "POST" && url.pathname === "/api/login") {
      return this.login(request);
    }
    return new Response("not found", { status: 404 });
  }

  private async register(request: Request): Promise<Response> {
    const { code, username, displayName, password } = await request.json<{
      code: string; username: string; displayName: string; password: string;
    }>();

    if (!code || !username || !displayName || !password) {
      return Response.json({ code: "eksik_alan", message: "Tüm alanlar zorunlu." }, { status: 400 });
    }
    if (password.length < 8) {
      return Response.json({ code: "kisa_parola", message: "Parola en az 8 karakter olmalı." }, { status: 400 });
    }

    const invite = this.sql
      .exec<{ code: string; used_by: string | null }>(
        "SELECT code, used_by FROM invites WHERE code = ?", code)
      .toArray()[0];

    if (!invite || invite.used_by !== null) {
      return Response.json({ code: "gecersiz_davet", message: "Davet kodu geçersiz." }, { status: 403 });
    }

    const mevcut = this.sql
      .exec("SELECT id FROM users WHERE username = ?", username).toArray();
    if (mevcut.length > 0) {
      return Response.json({ code: "kullanici_var", message: "Bu kullanıcı adı alınmış." }, { status: 409 });
    }

    const id = crypto.randomUUID();
    const salt = newSalt();
    const passwordHash = await hashPassword(password, salt);
    const now = Date.now();

    this.sql.exec(
      "INSERT INTO users (id, username, display_name, password_hash, salt, created_at) VALUES (?, ?, ?, ?, ?, ?)",
      id, username, displayName, passwordHash, salt, now
    );
    this.sql.exec("UPDATE invites SET used_by = ?, used_at = ? WHERE code = ?", id, now, code);

    const token = await this.issueSession(id);
    return Response.json({ token, user: { id, username, displayName } }, { status: 201 });
  }

  private async login(request: Request): Promise<Response> {
    const { username, password } = await request.json<{ username: string; password: string }>();

    const row = this.sql
      .exec<UserRow>("SELECT * FROM users WHERE username = ?", username ?? "")
      .toArray()[0];

    // Kullanıcı yoksa da hash hesapla: varlık bilgisi zamanlamadan sızmasın.
    const salt = row?.salt ?? newSalt();
    const attempt = await hashPassword(password ?? "", salt);

    if (!row || !timingSafeEqual(attempt, row.password_hash)) {
      return Response.json({ code: "gecersiz_giris", message: "Kullanıcı adı veya parola hatalı." }, { status: 401 });
    }

    const token = await this.issueSession(row.id);
    return Response.json({
      token,
      user: { id: row.id, username: row.username, displayName: row.display_name },
    });
  }

  private async issueSession(userId: string): Promise<string> {
    const token = newSessionToken();
    const now = Date.now();
    this.sql.exec(
      "INSERT INTO sessions (token_hash, user_id, created_at, last_seen) VALUES (?, ?, ?, ?)",
      await hashToken(token), userId, now, now
    );
    return token;
  }

  /** Task 5 kullanır. Geçersiz token'da null döner. */
  async authenticate(token: string): Promise<User | null> {
    if (!token) return null;
    const row = this.sql
      .exec<{ id: string; username: string; display_name: string }>(
        `SELECT u.id, u.username, u.display_name
         FROM sessions s JOIN users u ON u.id = s.user_id
         WHERE s.token_hash = ?`,
        await hashToken(token)
      )
      .toArray()[0];
    if (!row) return null;
    return { id: row.id, username: row.username, displayName: row.display_name };
  }
}
