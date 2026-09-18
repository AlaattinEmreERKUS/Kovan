import { PING, PONG, type ClientEvent, type ServerEvent, type VoiceMember } from "@shared/protocol";
import { applyReactions, lastMessageId, reactionKey, store } from "./store.svelte";
import { resetVoice, voice } from "./voice.svelte";
import { kopmaKaydet } from "./kopma-kaydi";

const TYPING_ARALIK = 3000;
const BACKOFF_BASLANGIC = 1000;
const BACKOFF_TAVAN = 30000;
const TYPING_SONME = 4000;
/**
 * Canli tutma araligi. Seste socket dakikalarca sessiz kaliyor ve 1006 ile
 * kesiliyordu (2026-09-19 kaydi: 6 kopma, hepsi 1006, ag ve sekme ayakta).
 * Sunucu cevabi auto-response ile verir, DO uyanmaz.
 */
export const PING_ARALIK = 30_000;

export class Connection {
  private ws: WebSocket | null = null;
  private backoff = BACKOFF_BASLANGIC;
  private sonTyping = 0;
  private kapandi = false;
  private typingZamanlayicilar = new Map<string, ReturnType<typeof setTimeout>>();

  /** Mesh bu geri cagrilara baglanir (Task 11). */
  onVoiceMembers: ((members: VoiceMember[]) => void) | null = null;
  onSignal: ((from: string, data: unknown) => void) | null = null;
  /**
   * Sinyal kanali dustu. VoiceSession'in mesh'i, AudioContext'i ve mikrofonu
   * BU CAGRIDA birakilir; store'u temizlemek yetmiyordu -- nesneler acik
   * kaliyor, sonraki katilim uzerlerine yenisini yaziyordu.
   *
   * `true` dondururse oturum baglantilari kisa kopma toleransi boyunca AYAKTA
   * tutuyor demektir ve store temizlenmez.
   */
  onDisconnect: (() => boolean | void) | null = null;
  /** Socket geri geldi. Kopmadan once seste olan kendiliginden geri katilir. */
  onReconnect: (() => void) | null = null;

  constructor(private url: string, private token: string) {
    this.ac();
  }

  private ac(): void {
    store.durum = "baglaniyor";
    const ws = new WebSocket(`${this.url}?token=${encodeURIComponent(this.token)}`);
    this.ws = ws;
    let acildi = 0;
    // Son gelen cerceve (pong dahil). Kopmada "ne kadar sessizdi" sorusunu
    // cevaplar: ara cihaz zaman asimi acik kalma suresini degil sessizligi sayar.
    let sonMesaj = 0;
    let ping: ReturnType<typeof setInterval> | undefined;

    ws.onopen = () => {
      acildi = Date.now();
      sonMesaj = acildi;
      store.durum = "acik";
      ping = setInterval(() => {
        try { ws.send(PING); } catch { /* kapanmakta; onclose halleder */ }
      }, PING_ARALIK);
      this.backoff = BACKOFF_BASLANGIC;
      // İlk açılışta 0; yeniden bağlanmada kaçırılan mesajlar istenir.
      const son = lastMessageId();
      if (son > 0) this.send({ t: "sync", lastMessageId: son });
      // Ilk acilista da calisir; niyeti olmayan oturum icin islemsizdir.
      this.onReconnect?.();
    };

    ws.onmessage = (e: MessageEvent) => {
      sonMesaj = Date.now();
      if (e.data === PONG) return;
      this.handle(JSON.parse(e.data as string) as ServerEvent);
    };

    ws.onclose = (e?: CloseEvent) => {
      clearInterval(ping);
      // Bilincli kapanis (close()) kopma degildir, kayda girmez. Teshis kaydi
      // ne olursa olsun asagidaki yeniden baglanmayi ENGELLEYEMEZ.
      if (!this.kapandi) {
        try {
          kopmaKaydet({
            tur: "ws",
            kod: e?.code ?? 0,
            sebep: e?.reason ?? "",
            temiz: e?.wasClean ?? false,
            // Hic acilamadiysa 0: yeniden baglanma denemesi basarisiz oldu.
            acikKaldiSn: acildi ? Math.round((Date.now() - acildi) / 1000) : 0,
            sessizSn: sonMesaj ? Math.round((Date.now() - sonMesaj) / 1000) : undefined,
            cevrimici: typeof navigator === "undefined" ? undefined : navigator.onLine,
            gorunurluk: typeof document === "undefined" ? undefined : document.visibilityState,
          });
        } catch { /* teshis, akisi durdurmaz */ }
      }
      // SIRA onemli: once oturum karar verir (store'dan katilim durumunu
      // okur), sonra store temizlenir. Ters sirada oturum "zaten cikmis"
      // sanip baglantilari acik birakiyordu.
      //
      // Ses P2P akar: sinyal kanalinin bir saniyeligine gitmesi konusmayi
      // kesmez. Oturum baglantilari tutuyorsa store'u temizlemek yalan olur
      // -- kullanici hala karsi tarafi duyuyor.
      const tutuldu = this.onDisconnect?.() === true;
      if (!tutuldu) resetVoice();
      store.durum = "kopuk";
      if (this.kapandi) return;
      setTimeout(() => this.ac(), this.backoff);
      this.backoff = Math.min(this.backoff * 2, BACKOFF_TAVAN);
    };
  }

  private handle(event: ServerEvent): void {
    switch (event.t) {
      case "hello":
        store.me = event.me;
        store.members = event.members;
        store.messages = event.recentMessages;
        // Ayni SvelteSet ornegi korunur; yenisiyle degistirmek mevcut
        // aboneleri bosa dusurur.
        store.online.clear();
        for (const id of event.online) store.online.add(id);
        voice.members = event.voiceMembers;
        applyReactions(event.reactions);
        return;

      case "msg.new":
        if (!store.messages.some((m) => m.id === event.message.id)) {
          store.messages.push(event.message);
        }
        return;

      case "sync.result":
        for (const m of event.messages) {
          if (!store.messages.some((x) => x.id === m.id)) store.messages.push(m);
        }
        store.messages.sort((a, b) => a.id - b.id);
        return;

      case "reaction.update":
        store.reactions.set(reactionKey(event.messageId, event.emoji), event.userIds);
        return;

      case "member.new": {
        // Upsert: ayni kisi her baglandiginda geliyor, kopya birikmemeli.
        const i = store.members.findIndex((m) => m.id === event.user.id);
        if (i < 0) store.members.push(event.user);
        else store.members[i] = event.user;
        return;
      }

      case "member.gone":
        store.members = store.members.filter((m) => !event.userIds.includes(m.id));
        for (const id of event.userIds) store.online.delete(id);
        return;

      case "presence.update":
        if (event.online) store.online.add(event.userId);
        else store.online.delete(event.userId);
        return;

      case "typing": {
        store.typingUserIds.add(event.userId);
        clearTimeout(this.typingZamanlayicilar.get(event.userId));
        this.typingZamanlayicilar.set(
          event.userId,
          setTimeout(() => store.typingUserIds.delete(event.userId), TYPING_SONME)
        );
        return;
      }

      case "voice.members":
        voice.members = event.members;
        this.onVoiceMembers?.(event.members);
        return;

      case "signal":
        this.onSignal?.(event.from, event.data);
        return;

      case "error":
        console.error(`[kovan] ${event.code}: ${event.message}`);
        // Ses hatalari kullaniciya gosterilir: sessizce konsola dusen bir
        // "ses_dolu" kullaniciyi bozuk mikrofon aramaya gonderir.
        if (event.code.startsWith("ses_") || event.code === "seste_degil") {
          voice.error = event.message;
        }
        return;
    }
  }

  send(event: ClientEvent): void {
    try {
      this.ws?.send(JSON.stringify(event));
    } catch {
      // Kapanmakta olan socket InvalidStateError firlatir. Yeniden baglanma
      // zaten kuyrukta; burada patlamak cagiran akisi (ornegin ayrilma
      // temizligini) yarida birakirdi.
    }
  }

  /** Kota koruması: 3 saniyede en fazla bir paket. */
  typing(): void {
    const simdi = Date.now();
    if (simdi - this.sonTyping < TYPING_ARALIK) return;
    this.sonTyping = simdi;
    this.send({ t: "typing" });
  }

  close(): void {
    this.kapandi = true;
    this.ws?.close();
  }
}
