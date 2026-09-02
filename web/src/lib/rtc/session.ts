import type { VoiceMember } from "@shared/protocol";
import type { Connection } from "../connection.svelte";
import { bosTracks, bosYerel, localFlags, voice } from "../voice.svelte";
import { LocalMedia } from "./media";
import { Mesh } from "./mesh";
import { Peer, type SignalPayload, type TrackSlot } from "./peer";
import { SpeakingDetector } from "./speaking";
import { ekranMikseri, mikrofonMikseri, type RemoteAudioMixer } from "./gain";
import { MikrofonIsleyici } from "./mikrofon";
import { sesAyarlariOku, sesAyarlariYaz, type SesAyarlari } from "../ses-ayarlari";

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
  mixer: RemoteAudioMixer | null = null;
  /** Kisi bazli mikrofon seviyesi; RemoteAudio yalnizca bu yokken calar. */
  micMixer: RemoteAudioMixer | null = null;
  /** Giden mikrofonun kapisi. Yoksa ham track gonderilir. */
  private mikIsleyici: MikrofonIsleyici | null = null;

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
      // Kendi konusma gostergen KAPIDAN gelir: kapi kapaliyken karsi taraf
      // seni duymuyor, gostergenin yaniyor olmasi yanlis bilgi olurdu.
      if (this.media.mic) {
        this.mikIsleyici = new MikrofonIsleyici({
          ctx: this.audioCtx,
          track: this.media.mic,
          esik: voice.sesAyarlari.esik,
          onSeviye: (seviye, acik) => {
            voice.girisSeviyesi = seviye;
            if (acik && !voice.muted) voice.speaking.add(this.o.selfId);
            else voice.speaking.delete(this.o.selfId);
          },
        });
      }
      this.mixer = ekranMikseri(this.audioCtx);
      this.mixer.setDeafened(voice.deafened);
      this.micMixer = mikrofonMikseri(this.audioCtx);
      this.micMixer.setDeafened(voice.deafened);
      // Bilesenler mikserleri store'dan okur; alan atamasi tepkisel degil.
      voice.ekranMikseri = this.mixer;
      voice.mikMikseri = this.micMixer;
    }

    this.mesh = new Mesh({
      selfId: this.o.selfId,
      createPeer: (userId, polite) => this.createPeer(userId, polite),
      onPeerGone: (userId) => {
        voice.remote.delete(userId);
        voice.speaking.delete(userId);
        this.speaking?.unwatch(userId);
        this.mixer?.detach(userId);
        this.micMixer?.detach(userId);
        voice.connection.delete(userId);
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
    this.mikIsleyici?.close();
    this.mikIsleyici = null;
    voice.girisSeviyesi = 0;
    this.mixer?.close();
    this.mixer = null;
    this.micMixer?.close();
    this.micMixer = null;
    voice.ekranMikseri = null;
    voice.mikMikseri = null;
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
    voice.local = bosYerel();
    voice.speaking.clear();
    voice.connection.clear();
  }

  /** Teshis: cihazin GERCEKTEN uyguladigi ses ayarlari. */
  mikAyari(): MediaTrackSettings | null {
    return this.media.mic?.getSettings() ?? null;
  }

  /** Kapidan gecmis track varsa o gider; yoksa ham mikrofon. */
  private gidenMik(): MediaStreamTrack | null {
    return this.mikIsleyici?.cikis ?? this.media.mic;
  }

  /** Kapi esigi ve tarayici filtreleri; ikisi de yerel ve kaliciDIR. */
  async setSesAyarlari(a: SesAyarlari): Promise<void> {
    voice.sesAyarlari = a;
    sesAyarlariYaz(a);
    this.mikIsleyici?.setEsik(a.esik);
    await this.media.setFiltreler(a);
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
    this.micMixer?.setDeafened(deafened);
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
    // Yeni nesne: ayni referansi tekrar yazmak aboneleri uyandirmaz.
    voice.local = { ...voice.local, cam: on ? this.media.cam : null };
    voice.camera = on;
    this.publish();
  }

  async startScreen(): Promise<void> {
    if (voice.screen) return;
    let video: MediaStreamTrack;
    let audio: MediaStreamTrack | null;
    try {
      ({ video, audio } = await this.media.startScreen());
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

    voice.local = { ...voice.local, screenVideo: video };
    voice.screen = true;
    voice.screenAudio = audio !== null;
    this.publish();
  }

  stopScreen(): void {
    if (!voice.screen) return;
    this.mesh?.setTrack("screenVideo", null);
    this.mesh?.setTrack("screenAudio", null);
    this.media.stopScreen();
    voice.local = { ...voice.local, screenVideo: null };
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
      onStateChange: (durum) => voice.connection.set(userId, durum),
    });

    // Baglanti kurulur kurulmaz yerel track'ler yerine oturur. replaceTrack
    // yeni transceiver acmaz, bu yuzden ekstra negotiation turu olmaz.
    peer.setTrack("mic", this.gidenMik());
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

    // Track geldigi anda yazilir ve `ended` gelene kadar store'da KALIR.
    //
    // Onceden mute/unmute olaylari yuvayi doldurup bosaltiyordu; amac karsi
    // taraf kamerayi hic acmamisken bos siyah kare cizmemekti. Ama Chrome
    // mute'u gecici paket kaybinda ve bant genisligi dususunde de atesliyor:
    // yuva null oluyor, <video> DOM'dan sokuluyor, kare siyaha dusup geri
    // geliyor. Gozlenen titremenin ikinci kaynagi buydu.
    //
    // "Kamera kapali" ile "ag takildi" RTP seviyesinde ayni sinyaldir; ayirt
    // eden bilgi sunucudan gelen VoiceMember.camera / .screen bayraklaridir.
    // Gorunurluk karari bu yuzden stage.ts'te o bayraklardan veriliyor.
    yaz(track);
    if (slot === "mic") {
      // SIRA ONEMLI: once mikser kaynagi acar, gosterge onu ODUNC ALIR.
      // Ikinci bir kaynak acilirsa Chrome ona sessizlik verir.
      this.micMixer?.attach(userId, track);
      const kaynak = this.micMixer?.sourceOf(userId) ?? null;
      if (kaynak) this.speaking?.watchSource(userId, kaynak);
      else this.speaking?.watch(userId, track);
    }
    if (slot === "screenAudio") this.mixer?.attach(userId, track);

    track.addEventListener("ended", () => {
      yaz(null);
      if (slot === "screenAudio") this.mixer?.detach(userId);
      if (slot === "mic") this.micMixer?.detach(userId);
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
