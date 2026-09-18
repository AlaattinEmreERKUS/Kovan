import { ensureSchema } from "./schema";
import type { Env } from "./worker";
import { hashPassword, hashToken, newSalt, newSessionToken, timingSafeEqual } from "./auth";
import { type SocketState, broadcast, onlineUserIds, readState, sendToVoice, socketsOf, writeState } from "./sockets";
import {
  MAX_CONTENT, MAX_EMOJI, insertMessage, messageExists, messagesAfter,
  reactionsFor, recentMessages, toggleReaction,
} from "./messages";
import { MAX_SIGNAL, VOICE_CAP, sanitizeVoiceFlags, voiceFull, voiceMembers } from "./voice";
import { iceServers } from "./turn";
import { kullaniciListesi, kullanicilariSil } from "./users";
import type { ClientEvent, ServerEvent, User } from "@shared/protocol";
// Tip disi deger: @shared alias yalniz tipte cozulur, runtime icin goreli yol.
import { PING, PONG } from "../../shared/protocol";

interface UserRow extends Record<string, SqlStorageValue> {
  id: string;
  username: string;
  display_name: string;
  password_hash: string;
  salt: string;
}

export class KovanServer implements DurableObject {
  private sql: SqlStorage;

  constructor(private ctx: DurableObjectState, private env: Env) {
    this.sql = ctx.storage.sql;
    ensureSchema(this.sql);
    // Cevabi runtime verir: DO uyanmaz, wall-clock yazilmaz.
    ctx.setWebSocketAutoResponse(new WebSocketRequestResponsePair(PING, PONG));
  }

  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);

    if (request.method === "POST" && url.pathname === "/api/register") {
      return this.register(request);
    }
    if (request.method === "POST" && url.pathname === "/api/login") {
      return this.login(request);
    }
    // Yonetici davet ucu. DO SQLite'a CLI'dan erisim yok; davet uretmenin
    // tek yolu bu. Anahtar sabit zamanda karsilastirilir.
    if (request.method === "POST" && url.pathname === "/api/admin/invite") {
      if (!this.yoneticiMi(request)) return new Response("forbidden", { status: 403 });
      const body = await KovanServer.readObject(request);
      const code = typeof body?.code === "string" ? body.code.trim() : "";
      if (!code || code.length > 64) {
        return Response.json({ code: "gecersiz_kod", message: "Davet kodu gecersiz." }, { status: 400 });
      }
      this.sql.exec("INSERT OR IGNORE INTO invites (code) VALUES (?)", code);
      return Response.json({ ok: true });
    }

    // Kimin kayitli oldugunu silmeden once gormek icin. Uye listesi arayuzde
    // de var ama silme kararini mesaj sayisiyla birlikte vermek gerekiyor.
    if (request.method === "GET" && url.pathname === "/api/admin/users") {
      if (!this.yoneticiMi(request)) return new Response("forbidden", { status: 403 });
      return Response.json({ users: kullaniciListesi(this.sql) });
    }

    // GERI ALINAMAZ. Silinen kullanicinin mesajlari ve tepkileri de gider.
    if (request.method === "POST" && url.pathname === "/api/admin/users/delete") {
      if (!this.yoneticiMi(request)) return new Response("forbidden", { status: 403 });
      const body = await KovanServer.readObject(request);
      const gelen = body?.usernames;
      if (!Array.isArray(gelen) || gelen.some((u) => typeof u !== "string")) {
        return Response.json(
          { code: "gecersiz_liste", message: "usernames bir metin dizisi olmali." },
          { status: 400 });
      }
      const { ids } = kullanicilariSil(this.sql, gelen as string[]);
      if (ids.length > 0) {
        // Acik socket'i olan silinmis kullanici, kaydi gitmis olmasina ragmen
        // konusmaya devam ederdi: once dusur, sonra digerlerine haber ver.
        for (const ws of this.ctx.getWebSockets()) {
          if (ids.includes(readState(ws).userId)) ws.close(4003, "hesap silindi");
        }
        broadcast(this.ctx, { t: "member.gone", userIds: ids });
      }
      return Response.json({ ok: true, silinen: ids.length });
    }

    // Yalnizca yerel gelistirmede: KOVAN_DEV bayragi wrangler dev --var ile
    // geliyor, deploy'da tanimsiz.
    if (request.method === "POST" && url.pathname === "/api/dev/invite" && this.env.KOVAN_DEV === "1") {
      const body = await KovanServer.readObject(request);
      const code = typeof body?.code === "string" ? body.code : "";
      if (!code) return Response.json({ ok: false }, { status: 400 });
      this.sql.exec("INSERT OR IGNORE INTO invites (code) VALUES (?)", code);
      return Response.json({ ok: true });
    }
    if (request.method === "GET" && url.pathname === "/api/turn") {
      // Oturum dogrulamasi burada yapilir: TURN credential uretmek para
      // harcayan tek cagri, davetsiz kullaniciya acilmaz.
      const user = await this.authenticate(url.searchParams.get("token") ?? "");
      if (!user) return new Response("unauthorized", { status: 401 });
      return Response.json({ iceServers: await iceServers(this.env, user.id) });
    }
    if (url.pathname === "/ws") {
      return this.openSocket(url);
    }
    return new Response("not found", { status: 404 });
  }

  private async openSocket(url: URL): Promise<Response> {
    const user = await this.authenticate(url.searchParams.get("token") ?? "");
    if (!user) {
      return new Response("unauthorized", { status: 401 });
    }

    const { 0: client, 1: server } = new WebSocketPair();
    this.ctx.acceptWebSocket(server);

    writeState(server, {
      userId: user.id,
      username: user.username,
      displayName: user.displayName,
      joinedAt: Date.now(),
      inVoice: false,
      muted: false,
      deafened: false,
      camera: false,
      screen: false,
      screenAudio: false,
    });

    const gecmis = recentMessages(this.sql);
    server.send(JSON.stringify({
      t: "hello",
      me: user,
      members: this.allUsers(),
      recentMessages: gecmis,
      reactions: reactionsFor(this.sql, gecmis.map((m) => m.id)),
      online: onlineUserIds(this.ctx),
      voiceMembers: voiceMembers(this.allSocketStates()),
    } satisfies ServerEvent));

    // Yeni uye DIGERLERINE tanitilir. Bu olmadan, sen bagliyken kayit olan
    // birinin adi sende "…" kalir ve ancak sayfa yenilenince gelir.
    broadcast(this.ctx, { t: "member.new", user }, server);
    broadcast(this.ctx, { t: "presence.update", userId: user.id, online: true }, server);

    return new Response(null, { status: 101, webSocket: client });
  }

  /** Sabit zamanli karsilastirma: anahtar tahmini zamanlamadan sizmasin. */
  private yoneticiMi(request: Request): boolean {
    const key = this.env.ADMIN_KEY;
    const gelen = request.headers.get("x-admin") ?? "";
    return Boolean(key) && timingSafeEqual(gelen, key!);
  }

  private allUsers(): User[] {
    return this.sql
      .exec<{ id: string; username: string; display_name: string }>(
        "SELECT id, username, display_name FROM users ORDER BY created_at")
      .toArray()
      .map((r) => ({ id: r.id, username: r.username, displayName: r.display_name }));
  }

  /** Ses listesi DAIMA acik socket attachment'larindan turetilir (R3). */
  private allSocketStates(): SocketState[] {
    return this.ctx.getWebSockets().map(readState);
  }

  private broadcastVoice(): void {
    broadcast(this.ctx, { t: "voice.members", members: voiceMembers(this.allSocketStates()) });
  }

  async webSocketMessage(ws: WebSocket, raw: string | ArrayBuffer): Promise<void> {
    if (typeof raw !== "string") return;

    let event: unknown;
    try {
      event = JSON.parse(raw);
    } catch {
      return this.fail(ws, "bozuk_paket", "Geçersiz JSON.");
    }
    // "null" ve 42 gecerli JSON'dur ama olay degildir; alan okumasi patlamasin.
    if (typeof event !== "object" || event === null || Array.isArray(event)) {
      return this.fail(ws, "bozuk_paket", "Olay bir nesne olmalı.");
    }

    const state = readState(ws);

    switch ((event as ClientEvent).t) {
      case "msg.send":
        return this.handleSend(ws, state, event as Extract<ClientEvent, { t: "msg.send" }>);
      case "typing":
        // Sunucuda throttle YOK; kota korumasi istemcide (Task 12).
        broadcast(this.ctx, { t: "typing", userId: state.userId }, ws);
        return;
      case "reaction.toggle": {
        const ham = event as { messageId?: unknown; emoji?: unknown };
        // Emoji ham haliyle SQL'e verilirse (nesne, sayi) bind hatasi firlar
        // ve handler icindeki hata socket'i sessizce oldurur.
        if (typeof ham.emoji !== "string" || ham.emoji.length === 0 || ham.emoji.length > MAX_EMOJI) {
          return this.fail(ws, "gecersiz_emoji", "Geçersiz emoji.");
        }
        const messageId = typeof ham.messageId === "number" && Number.isInteger(ham.messageId)
          ? ham.messageId : -1;
        if (!messageExists(this.sql, messageId)) {
          return this.fail(ws, "mesaj_yok", "Mesaj bulunamadı.");
        }
        const userIds = toggleReaction(this.sql, messageId, state.userId, ham.emoji);
        broadcast(this.ctx, {
          t: "reaction.update", messageId, emoji: ham.emoji, userIds,
        });
        return;
      }
      case "voice.join":
        return this.handleVoiceJoin(ws, state);
      case "voice.leave":
        return this.handleVoiceLeave(ws, state);
      case "voice.state": {
        if (!state.inVoice) {
          return this.fail(ws, "seste_degil", "Önce ses kanalına katılın.");
        }
        // Bes bayragin hepsi boolean degilse paket topluca reddedilir. Ham
        // deger attachment a yazilirsa hibernation sonrasi bozuk state geri
        // yuklenir ve yayin JSON u sessizce bozulur.
        const flags = sanitizeVoiceFlags(event);
        if (!flags) {
          return this.fail(ws, "gecersiz_durum", "Ses durumu geçersiz.");
        }
        writeState(ws, flags);
        this.broadcastVoice();
        return;
      }
      case "signal": {
        if (!state.inVoice) {
          return this.fail(ws, "seste_degil", "Önce ses kanalına katılın.");
        }
        // raw uzunlugu JSON un tamamini olcer; data yeniden serilestirilmez,
        // boylece dev bir paket parse sonrasi ikinci kez kopyalanmaz.
        if (raw.length > MAX_SIGNAL) {
          return this.fail(ws, "buyuk_sinyal", "Sinyal paketi çok büyük.");
        }
        const ham = event as { target?: unknown; data?: unknown };
        if (typeof ham.target !== "string" || ham.target.length === 0 || ham.target === state.userId) {
          return this.fail(ws, "gecersiz_hedef", "Sinyal hedefi geçersiz.");
        }
        if (ham.data === undefined) {
          return this.fail(ws, "bos_sinyal", "Sinyal gövdesi boş.");
        }
        const hedefSeste = this.allSocketStates()
          .some((s) => s.userId === ham.target && s.inVoice);
        if (!hedefSeste) {
          return this.fail(ws, "hedef_seste_degil", "Hedef ses kanalında değil.");
        }
        // Sunucu SDP nin icine BAKMAZ; paket oldugu gibi gecer (spec 5).
        sendToVoice(this.ctx, ham.target, { t: "signal", from: state.userId, data: ham.data });
        return;
      }
      case "sync": {
        // Sayi olmayan / ondalikli / negatif deger bastan senkron sayilir.
        // Ham deger SQL'e verilirse SQLite tur onceligi yuzunden sessizce
        // bos sonuc doner ve istemci gecmisi kayip saniyor.
        const ham = (event as { lastMessageId?: unknown }).lastMessageId;
        const lastId = typeof ham === "number" && Number.isInteger(ham) && ham > 0 ? ham : 0;
        const messages = messagesAfter(this.sql, lastId);
        ws.send(JSON.stringify({ t: "sync.result", messages } satisfies ServerEvent));
        return;
      }
      default:
        return this.fail(ws, "bilinmeyen_olay", `Tanınmayan olay: ${(event as { t: string }).t}`);
    }
  }

  private handleSend(
    ws: WebSocket,
    state: SocketState,
    event: Extract<ClientEvent, { t: "msg.send" }>
  ): void {
    // content string olmayabilir (istemci bozuk olabilir): trim() cagrisi
    // patlarsa handler icinde firlatilan hata socket'i sessizce oldurur.
    const content = typeof event.content === "string" ? event.content.trim() : "";
    if (content.length === 0) return this.fail(ws, "bos_mesaj", "Boş mesaj gönderilemez.");
    if (content.length > MAX_CONTENT) {
      return this.fail(ws, "uzun_mesaj", `Mesaj en fazla ${MAX_CONTENT} karakter olabilir.`);
    }
    const localId = typeof event.localId === "string" ? event.localId : undefined;

    const message = insertMessage(this.sql, state.userId, content);

    // Gönderene localId ile döner (optimistic UI eşlemesi), diğerlerine sade.
    ws.send(JSON.stringify({ t: "msg.new", message, localId } satisfies ServerEvent));
    broadcast(this.ctx, { t: "msg.new", message }, ws);
  }

  private handleVoiceJoin(ws: WebSocket, state: SocketState): void {
    // Cift tiklama ya da yeniden gonderim: sessiz gec, yayini tekrarlama.
    if (state.inVoice) return;
    if (voiceFull(this.allSocketStates(), state.userId)) {
      return this.fail(ws, "ses_dolu", `Ses kanalı dolu (en fazla ${VOICE_CAP} kişi).`);
    }
    writeState(ws, {
      inVoice: true, muted: false, deafened: false,
      camera: false, screen: false, screenAudio: false,
    });
    this.broadcastVoice();
  }

  private handleVoiceLeave(ws: WebSocket, state: SocketState): void {
    if (!state.inVoice) return;
    // Bayraklar da sifirlanir: kamerasi acikken cikip geri girenin karesi
    // aksi halde uye listesinde acik gorunur.
    writeState(ws, {
      inVoice: false, muted: false, deafened: false,
      camera: false, screen: false, screenAudio: false,
    });
    this.broadcastVoice();
  }

  private fail(ws: WebSocket, code: string, message: string): void {
    ws.send(JSON.stringify({ t: "error", code, message } satisfies ServerEvent));
  }

  async webSocketClose(ws: WebSocket): Promise<void> {
    this.birak(ws);
  }

  /**
   * ANI KOPMA. Internet giderse TCP FIN gelmez ve runtime webSocketClose
   * DEGIL bunu cagirir. Isleyici olmadigi surece hicbir temizlik yapilmiyor,
   * hicbir yayin gitmiyordu: kopan kisi digerlerinin ses listesinde hayalet
   * olarak kaliyor, geri baglandiginda mesh onu "zaten var" sayip yeni
   * baglanti kurmuyor ve kimse onu duyamiyordu.
   */
  async webSocketError(ws: WebSocket): Promise<void> {
    this.birak(ws);
    // Socket'i acikca kapat: aksi halde getWebSockets() icinde durmaya devam
    // eder ve sonradan turetilen her liste (hello, voiceFull) onu sayar.
    try {
      ws.close(1011, "baglanti hatasi");
    } catch {
      // Zaten olu socket. Kapatmak sadece listeyi temizlemek icindi.
    }
  }

  /**
   * Bir socket'in dusmesi. Hem temiz kapanis hem ani kopma buraya gelir.
   * Iki kez cagrilmasi zararsizdir: inVoice ilk turda dusurulur, ikinci
   * turda ses yayini tekrarlanmaz.
   */
  private birak(ws: WebSocket): void {
    const state = readState(ws);
    // Dusen socket getWebSockets() icinde bir sure daha gorunebilir. Listeyi
    // broadcastVoice() ile turetirsek ayrilan kisi listede kalir ve digerleri
    // hic gelmeyecek bir offer bekler. Bu yuzden onu ACIKCA eliyoruz.
    const kalan = this.ctx.getWebSockets().filter((s) => s !== ws);

    // Bu kullanıcının başka açık socket'i yoksa offline sayılır.
    if (!kalan.some((s) => readState(s).userId === state.userId)) {
      broadcast(this.ctx, { t: "presence.update", userId: state.userId, online: false }, ws);
    }
    if (state.inVoice) {
      // Yayin ONCE: `kalan` zaten bu socket'i disliyor, yani asagidaki
      // attachment yazimi patlasa bile digerleri dogru listeyi alir.
      broadcast(this.ctx, { t: "voice.members", members: voiceMembers(kalan.map(readState)) }, ws);
      try {
        // Bayrak attachment'ta kalirsa, socket kapanana kadar SONRADAN
        // turetilen her liste (hello, voiceFull) kisiyi seste sayar.
        writeState(ws, { inVoice: false });
      } catch {
        // Arizali socket'e yazilamadi. Kapatma zaten webSocketError'da.
      }
    }
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
