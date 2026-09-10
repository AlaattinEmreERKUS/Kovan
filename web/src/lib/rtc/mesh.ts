import type { EkranOzeti, Peer, SignalPayload, TrackSlot } from "./peer";
import { isPolite } from "./politeness";

export interface MeshDeps {
  selfId: string;
  createPeer(userId: string, polite: boolean): Peer;
  /** Baglanti kapandiginda arayuzun uzak track'leri temizlemesi icin. */
  onPeerGone(userId: string): void;
}

/**
 * Ses kanalindaki herkesle birer baglanti tutar. Tek girdisi sunucudan gelen
 * uye listesidir; listeyle mevcut baglantilar arasindaki FARKI uygular.
 */
export class Mesh {
  private peers = new Map<string, Peer>();

  constructor(private deps: MeshDeps) {}

  setMembers(userIds: string[]): void {
    const hedef = new Set(userIds.filter((id) => id !== this.deps.selfId));

    for (const id of hedef) {
      if (this.peers.has(id)) continue;
      this.peers.set(id, this.deps.createPeer(id, isPolite(this.deps.selfId, id)));
    }

    for (const [id, peer] of [...this.peers]) {
      if (hedef.has(id)) continue;
      peer.close();
      this.peers.delete(id);
      this.deps.onPeerGone(id);
    }
  }

  handleSignal(from: string, data: SignalPayload): void {
    const peer = this.peers.get(from);
    // Taninmayan gonderen. Sunucu voice.members yayinini ilgili signal'den
    // ONCE gonderdigi ve tek WS uzerinde sira korundugu icin bu normalde
    // olmaz; olursa paketi dusurmek yarim baglanti acmaktan iyidir.
    if (!peer) return;
    void peer.handleSignal(data).catch((e) => console.error("[kovan] sinyal islenemedi", e));
  }

  setTrack(slot: TrackSlot, track: MediaStreamTrack | null): void {
    for (const peer of this.peers.values()) peer.setTrack(slot, track);
  }

  setIceServers(iceServers: RTCIceServer[]): void {
    for (const peer of this.peers.values()) peer.setIceServers(iceServers);
  }

  /** Her izleyiciye AYRI encode gider; kalitesi de izleyici basina ayridir. */
  async ekranIstatistikleri(): Promise<Array<{ userId: string; giden: EkranOzeti | null }>> {
    return Promise.all([...this.peers].map(async ([userId, peer]) => ({
      userId, giden: await peer.ekranIstatistigi(),
    })));
  }

  has(userId: string): boolean {
    return this.peers.has(userId);
  }

  get size(): number {
    return this.peers.size;
  }

  close(): void {
    for (const peer of this.peers.values()) peer.close();
    this.peers.clear();
  }
}
