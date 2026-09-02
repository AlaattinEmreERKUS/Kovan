import type { VoiceMember } from "@shared/protocol";
import type { Connection } from "../connection.svelte";
import { bosTracks, localFlags, voice } from "../voice.svelte";
import { LocalMedia } from "./media";
import { Mesh } from "./mesh";
import { Peer, type SignalPayload, type TrackSlot } from "./peer";
import { SpeakingDetector } from "./speaking";
import type { ShareOptions } from "./share";
import { ScreenAudioMixer } from "./gain";

export interface SessionOptions {
  conn: Connection;
  selfId: string;
  apiUrl: string;
  token: string;
  media?: LocalMedia;
  createPeerConnection?(cfg: RTCConfiguration): RTCPeerConnection;
  fetchImpl?: typeof fetch;
  /** Node testinde AudioContext yok; disaridan verilebilir. */
  createAudioContext?(): AudioContext | null;
}

/** TURN alinamazsa bile kanal acilir; ev aglarinin cogunda STUN yeter. */
const YEDEK_ICE: RTCIceServer[] = [{ urls: "stun:stun.cloudflare.com:3478" }];

/**
 * Ses oturumunun tek sahibi. Component'ler WebRTC API'sine dokunmaz; yalnizca
 * bu sinifin metotlarini cagirir ve `voice` store'unu okur.
 */
export class VoiceSession {
  private mesh: Mesh | null = null;
  private media: LocalMedia;
  private ice: RTCIceServer[] = YEDEK_ICE;
  private audioCtx: AudioContext | null = null;
  private speaking: SpeakingDetector | null = null;
  /** Arayuz kaydiriciyi buradan okur; kisiye ozel, sunucuya gitmez. */
  mixer: ScreenAudioMixer | null = null;

  constructor(private o: SessionOptions) {
    this.media = o.media ?? new LocalMedia();
    o.conn.onVoiceMembers = (members) => this.onMembers(members);
    o.conn.onSignal = (from, data) => this.mesh?.handleSignal(from, data as SignalPayload);
  }

  async join(): Promise<void> {
    if (voice.joined) return;
    voice.error = null;

    try {
      await this.media.startMic();
    } catch {
      // En sik gercek ariza bu: kullanici izni reddetti ya da cihaz yok.
      // Seste gorunup sessiz durmak, hata gostermekten cok daha kotu.
      voice.error = "Mikrofona erişilemedi. Tarayıcı izinlerini kontrol edin.";
      return;
    }

    this.ice = await this.fetchIce();
    this.audioCtx = (this.o.createAudioContext ?? (() => new AudioContext()))();
    if (this.audioCtx) {
      // AudioContext tarayici politikasi geregi "suspended" baslayabilir.
      // Devam ettirilmezse AnalyserNode sifir doner (konusma gostergesi olur)
      // ve GainNode zincirinden ses cikmaz (ekran sesi duyulmaz).
      void this.audioCtx.resume().catch(() => {});
      this.speaking = new SpeakingDetector({
        ctx: this.audioCtx,
        onChange: (userId, konusuyor) => {
          if (konusuyor) voice.speaking.add(userId);
          else voice.speaking.delete(userId);
        },
      });
      if (this.media.mic) this.speaking.watch(this.o.selfId, this.media.mic);
      this.mixer = new ScreenAudioMixer(this.audioCtx);
      this.mixer.setDeafened(voice.deafened);
    }

    this.mesh = new Mesh({
      selfId: this.o.selfId,
      createPeer: (userId, polite) => this.createPeer(userId, polite),
      onPeerGone: (userId) => {
        voice.remote.delete(userId);
        voice.speaking.delete(userId);
        this.speaking?.unwatch(userId);
        this.mixer?.detach(userId);
      },
    });

    voice.joined = true;
    this.o.conn.send({ t: "voice.join" });
    // Sunucu yayini gelmeden once bilinen liste uygulanir: hello ile gelen
    // uyeler varsa baglanti hemen kurulmaya baslar.
    this.mesh.setMembers(voice.members.map((m) => m.userId));
    this.media.setMuted(voice.muted);
  }

  leave(): void {
    if (!voice.joined) return;
    this.o.conn.send({ t: "voice.leave" });
    this.mesh?.close();
    this.mesh = null;
    this.speaking?.stop();
    this.speaking = null;
    this.mixer?.close();
    this.mixer = null;
    void this.audioCtx?.close();
    this.audioCtx = null;
    this.media.stopAll();
    voice.joined = false;
    voice.muted = false;
    voice.deafened = false;
    voice.camera = false;
    voice.screen = false;
    voice.screenAudio = false;
    voice.remote.clear();
    voice.speaking.clear();
  }

  setMuted(muted: boolean): void {
    if (voice.muted === muted) return;   // kota: degismeyen durum yayilmaz
    voice.muted = muted;
    this.media.setMuted(muted);
    this.publish();
  }

  /** Discord davranisi: deafen kendi mikrofonunu da kapatir. */
  setDeafened(deafened: boolean): void {
    if (voice.deafened === deafened) return;
    voice.deafened = deafened;
    if (deafened) {
      voice.muted = true;
      this.media.setMuted(true);
    }
    this.mixer?.setDeafened(deafened);
    this.publish();
  }

  async setCamera(on: boolean): Promise<void> {
    if (voice.camera === on) return;
    if (on) {
      try {
        const track = await this.media.startCamera();
        this.mesh?.setTrack("cam", track);
      } catch {
        voice.error = "Kameraya erişilemedi.";
        return;
      }
    } else {
      this.mesh?.setTrack("cam", null);
      this.media.stopCamera();
    }
    voice.camera = on;
    this.publish();
  }

  async startScreen(o: ShareOptions): Promise<void> {
    if (voice.screen) return;
    let video: MediaStreamTrack;
    let audio: MediaStreamTrack | null;
    try {
      ({ video, audio } = await this.media.startScreen(o));
    } catch (e) {
      // NotAllowedError = kullanici native secicide vazgecti. Hata
      // GOSTERILMEZ; vazgecmek bir ariza degil (spec 8.1 adim 3).
      if ((e as DOMException)?.name !== "NotAllowedError") {
        voice.error = "Ekran paylaşımı başlatılamadı.";
      }
      return;
    }

    // Ayri transceiver'lar: izleyicinin ekran sesini mikrofondan bagimsiz
    // kisabilmesi buna bagli (spec 8.1 adim 4).
    this.mesh?.setTrack("screenVideo", video);
    this.mesh?.setTrack("screenAudio", audio);

    // Kullanici bizim seridimizi degil Chromium'un cubugunu kullanabilir.
    // Bu dinleyici olmadan digerleri olu bir kare gorur (spec 8.1 adim 6).
    video.addEventListener("ended", () => this.stopScreen());

    voice.screen = true;
    voice.screenAudio = audio !== null;
    this.publish();
  }

  stopScreen(): void {
    if (!voice.screen) return;
    this.mesh?.setTrack("screenVideo", null);
    this.mesh?.setTrack("screenAudio", null);
    this.media.stopScreen();
    voice.screen = false;
    voice.screenAudio = false;
    this.publish();
  }

  destroy(): void {
    this.leave();
    this.o.conn.onVoiceMembers = null;
    this.o.conn.onSignal = null;
  }

  private publish(): void {
    this.o.conn.send({ t: "voice.state", ...localFlags() });
  }

  private onMembers(members: VoiceMember[]): void {
    if (!this.mesh || !voice.joined) return;
    this.mesh.setMembers(members.map((m) => m.userId));
  }

  private createPeer(userId: string, polite: boolean): Peer {
    const pc = (this.o.createPeerConnection ?? ((cfg: RTCConfiguration) => new RTCPeerConnection(cfg)))(
      { iceServers: this.ice });

    const peer = new Peer({
      polite,
      pc,
      sendSignal: (data) => this.o.conn.send({ t: "signal", target: userId, data }),
      onTrack: (slot, track) => this.onRemoteTrack(userId, slot, track),
    });

    // Baglanti kurulur kurulmaz yerel track'ler yerine oturur. replaceTrack
    // yeni transceiver acmaz, bu yuzden ekstra negotiation turu olmaz.
    peer.setTrack("mic", this.media.mic);
    peer.setTrack("cam", this.media.cam);
    peer.setTrack("screenVideo", this.media.screenVideo);
    peer.setTrack("screenAudio", this.media.screenAudio);
    return peer;
  }

  private onRemoteTrack(userId: string, slot: TrackSlot, track: MediaStreamTrack): void {
    // Yeni nesne yazilir: SvelteMap ayni referansi tekrar set edince
    // aboneleri uyandirmaz.
    const yaz = (t: MediaStreamTrack | null) => {
      const mevcut = voice.remote.get(userId) ?? bosTracks();
      if (mevcut[slot] === t) return;
      voice.remote.set(userId, { ...mevcut, [slot]: t });
    };

    if (slot === "mic") {
      yaz(track);
      this.speaking?.watch(userId, track);
    } else {
      // ontrack HER m-line icin atesleniyor: karsi taraf kamerayi hic acmasa
      // da susturulmus bir cam track'i geliyor. Dogrudan yazsak VideoGrid
      // herkes icin bos siyah kare cizerdi. Track yalnizca medya aktigi
      // surece store'da durur.
      if (!track.muted) yaz(track);
      track.addEventListener("unmute", () => {
        yaz(track);
        if (slot === "screenAudio") this.mixer?.attach(userId, track);
      });
      track.addEventListener("mute", () => {
        yaz(null);
        if (slot === "screenAudio") this.mixer?.detach(userId);
      });
      if (slot === "screenAudio" && !track.muted) this.mixer?.attach(userId, track);
    }

    track.addEventListener("ended", () => {
      yaz(null);
      if (slot === "screenAudio") this.mixer?.detach(userId);
    });
  }

  private async fetchIce(): Promise<RTCIceServer[]> {
    const f = this.o.fetchImpl ?? fetch;
    try {
      const res = await f(`${this.o.apiUrl}/api/turn?token=${encodeURIComponent(this.o.token)}`);
      if (!res.ok) return YEDEK_ICE;
      const govde = await res.json() as { iceServers?: RTCIceServer[] };
      return govde.iceServers?.length ? govde.iceServers : YEDEK_ICE;
    } catch {
      return YEDEK_ICE;
    }
  }
}
