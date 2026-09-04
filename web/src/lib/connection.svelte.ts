import type { ClientEvent, ServerEvent, VoiceMember } from "@shared/protocol";
import { applyReactions, lastMessageId, reactionKey, store } from "./store.svelte";
import { resetVoice, voice } from "./voice.svelte";

const TYPING_ARALIK = 3000;
const BACKOFF_BASLANGIC = 1000;
const BACKOFF_TAVAN = 30000;
const TYPING_SONME = 4000;

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

    ws.onopen = () => {
      store.durum = "acik";
      this.backoff = BACKOFF_BASLANGIC;
      // İlk açılışta 0; yeniden bağlanmada kaçırılan mesajlar istenir.
      const son = lastMessageId();
      if (son > 0) this.send({ t: "sync", lastMessageId: son });
      // Ilk acilista da calisir; niyeti olmayan oturum icin islemsizdir.
      this.onReconnect?.();
    };

    ws.onmessage = (e: MessageEvent) => this.handle(JSON.parse(e.data as string) as ServerEvent);

    ws.onclose = () => {
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
