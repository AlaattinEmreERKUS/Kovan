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

  /**
   * Govdeyi nesne olarak okur. "null" gecerli JSON'dur ama nesne degildir;
   * dogrudan destructure edilirse TypeError firlatir ve istek yanitsiz duser.
   */
  private static async readObject(request: Request): Promise<Record<string, unknown> | null> {
    try {
      const parsed = await request.json();
      if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) return null;
      return parsed as Record<string, unknown>;
    } catch {
      return null;
    }
  }

  private async register(request: Request): Promise<Response> {
    const body = await KovanServer.readObject(request);
    if (!body) {
      return Response.json({ code: "bozuk_govde", message: "Geçersiz istek gövdesi." }, { status: 400 });
    }
    const { code, username, displayName, password } = body;

    if (
      typeof code !== "string" || typeof username !== "string" ||
      typeof displayName !== "string" || typeof password !== "string" ||
      !code || !username || !displayName || !password
    ) {
      return Response.json({ code: "eksik_alan", message: "Tüm alanlar zorunlu." }, { status: 400 });
    }
    if (password.length < 8) {
      return Response.json({ code: "kisa_parola", message: "Parola en az 8 karakter olmalı." }, { status: 400 });
    }
    if (password.length > 256) {
      return Response.json({ code: "uzun_parola", message: "Parola en fazla 256 karakter olabilir." }, { status: 400 });
    }
    if (username.length > 32) {
      return Response.json({ code: "uzun_kullanici_adi", message: "Kullanıcı adı en fazla 32 karakter olabilir." }, { status: 400 });
    }
    if (displayName.length > 64) {
      return Response.json({ code: "uzun_ad", message: "Görünen ad en fazla 64 karakter olabilir." }, { status: 400 });
    }

    // Parolayı EN BAŞTA, herhangi bir DB kontrolünden önce hashle. PBKDF2 (hashPassword)
    // senkron olmayan tek adım; DO'da yalnızca storage await'leri girdi kapısını (input gate)
    // serbest bırakır, bu da değil. Aşağıdaki kontrol-sonra-yaz bloğunda TEK BİR await bile
    // OLMAMALI: aksi halde iki eşzamanlı istek aynı daveti veya kullanıcı adını geçer ve
    // ikisi de yazar (race). Bu blok senkron this.sql.exec çağrılarından ibaret kaldığı sürece
    // Durable Object'in input gate'i onu bölünmez kılar.
    const id = crypto.randomUUID();
    const salt = newSalt();
    const passwordHash = await hashPassword(password, salt);
    const now = Date.now();

    // --- await YOK: kontrol-sonra-yaz bloğu, bölünmez olmak zorunda ---
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

    try {
      this.sql.exec(
        "INSERT INTO users (id, username, display_name, password_hash, salt, created_at) VALUES (?, ?, ?, ?, ?, ?)",
        id, username, displayName, passwordHash, salt, now
      );
    } catch {
      // Savunma katmanı: UNIQUE(username) yarışı buraya sızarsa yine 409 döndür, 500 değil.
      return Response.json({ code: "kullanici_var", message: "Bu kullanıcı adı alınmış." }, { status: 409 });
    }
    this.sql.exec("UPDATE invites SET used_by = ?, used_at = ? WHERE code = ?", id, now, code);
    // --- await YOK bloğu sona erdi ---

    const token = await this.issueSession(id);
    return Response.json({ token, user: { id, username, displayName } }, { status: 201 });
  }

  private async login(request: Request): Promise<Response> {
    const body = await KovanServer.readObject(request);
    if (!body) {
      return Response.json({ code: "bozuk_govde", message: "Geçersiz istek gövdesi." }, { status: 400 });
    }
    const username = typeof body.username === "string" ? body.username : "";
    const password = typeof body.password === "string" ? body.password : "";

    const row = this.sql
      .exec<UserRow>("SELECT * FROM users WHERE username = ?", username)
      .toArray()[0];

    // Kullanıcı yoksa da hash hesapla: varlık bilgisi zamanlamadan sızmasın.
    const salt = row?.salt ?? newSalt();
    const attempt = await hashPassword(password, salt);

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
