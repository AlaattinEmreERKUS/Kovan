import type { VoiceMember } from "@shared/protocol";
import type { Connection } from "../connection.svelte";
import { bosTracks, localFlags, voice } from "../voice.svelte";
import { LocalMedia } from "./media";
import { Mesh } from "./mesh";
import { Peer, type SignalPayload, type TrackSlot } from "./peer";

export interface SessionOptions {
  conn: Connection;
  selfId: string;
  apiUrl: string;
  token: string;
  media?: LocalMedia;
  createPeerConnection?(cfg: RTCConfiguration): RTCPeerConnection;
  fetchImpl?: typeof fetch;
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
    this.mesh = new Mesh({
      selfId: this.o.selfId,
      createPeer: (userId, polite) => this.createPeer(userId, polite),
      onPeerGone: (userId) => {
        voice.remote.delete(userId);
        voice.speaking.delete(userId);
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
    const mevcut = voice.remote.get(userId) ?? bosTracks();
    // Yeni nesne yazilir: SvelteMap ayni referansi tekrar set edince
    // aboneleri uyandirmaz.
    voice.remote.set(userId, { ...mevcut, [slot]: track });
    track.addEventListener("ended", () => {
      const simdiki = voice.remote.get(userId);
      if (simdiki?.[slot] === track) voice.remote.set(userId, { ...simdiki, [slot]: null });
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
