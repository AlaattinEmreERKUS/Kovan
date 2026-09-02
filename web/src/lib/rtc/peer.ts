export type TrackSlot = "mic" | "cam" | "screenVideo" | "screenAudio";

/**
 * TRANSCEIVER SIRASI PROTOKOLDUR. Her iki taraf da baglantiyi ayni sirada
 * kurar; uzak track'in hangi yuva oldugu m-line sirasindan bilinir. Sira
 * degisirse uzak taraf kamerayi ekran sanar.
 */
export const SLOT_ORDER: readonly TrackSlot[] = ["mic", "cam", "screenVideo", "screenAudio"];

const SLOT_KIND: Record<TrackSlot, "audio" | "video"> = {
  mic: "audio", cam: "video", screenVideo: "video", screenAudio: "audio",
};

export interface SignalPayload {
  description?: RTCSessionDescriptionInit;
  candidate?: RTCIceCandidateInit | null;
}

export interface PeerOptions {
  /** isPolite(kendiId, karsiId) sonucu. */
  polite: boolean;
  /** Disaridan enjekte edilir: node testinde sahtesi verilebilir. */
  pc: RTCPeerConnection;
  sendSignal(data: SignalPayload): void;
  onTrack(slot: TrackSlot, track: MediaStreamTrack): void;
  onStateChange?(state: RTCPeerConnectionState): void;
}

/**
 * Tek bir uzak kullaniciya giden baglanti. Perfect negotiation deseni (W3C
 * ornegi) birebir uygulanir; desen olmadan mesh 3+ kiside rastgele kopar.
 */
export class Peer {
  private makingOffer = false;
  private ignoreOffer = false;
  private settingRemoteAnswerPending = false;
  private senders = new Map<TrackSlot, RTCRtpSender>();

  constructor(private o: PeerOptions) {
    const pc = o.pc;
    for (const slot of SLOT_ORDER) {
      const tr = pc.addTransceiver(SLOT_KIND[slot], { direction: "sendrecv" });
      this.senders.set(slot, tr.sender);
    }

    pc.onnegotiationneeded = async () => {
      try {
        this.makingOffer = true;
        await pc.setLocalDescription();
        o.sendSignal({ description: pc.localDescription! });
      } catch (e) {
        console.error("[kovan] offer uretilemedi", e);
      } finally {
        this.makingOffer = false;
      }
    };

    pc.onicecandidate = ({ candidate }) => o.sendSignal({ candidate });

    pc.ontrack = (ev) => {
      const i = pc.getTransceivers().indexOf(ev.transceiver);
      const slot = SLOT_ORDER[i];
      if (!slot) return; // beklenmedik m-line: yoksay, patlama
      o.onTrack(slot, ev.track);
    };

    pc.onconnectionstatechange = () => o.onStateChange?.(pc.connectionState);
  }

  async handleSignal(data: SignalPayload): Promise<void> {
    const pc = this.o.pc;

    if (data.description) {
      const desc = data.description;
      const readyForOffer = !this.makingOffer &&
        (pc.signalingState === "stable" || this.settingRemoteAnswerPending);
      const collision = desc.type === "offer" && !readyForOffer;

      // Cakismada impolite taraf offer'i YOK SAYAR, polite taraf kabul eder.
      this.ignoreOffer = !this.o.polite && collision;
      if (this.ignoreOffer) return;

      this.settingRemoteAnswerPending = desc.type === "answer";
      await pc.setRemoteDescription(desc);
      this.settingRemoteAnswerPending = false;

      if (desc.type === "offer") {
        await pc.setLocalDescription();
        this.o.sendSignal({ description: pc.localDescription! });
      }
      return;
    }

    if (data.candidate !== undefined) {
      try {
        await pc.addIceCandidate(data.candidate ?? undefined);
      } catch (e) {
        // Yok sayilan offer'in adaylari gelmeye devam eder; onlarin hatasi
        // normaldir. Diger hatalar gercek arizadir, yutulmaz.
        if (!this.ignoreOffer) throw e;
      }
    }
  }

  /** Yeni transceiver ACILMAZ; mevcut sender'in track'i degistirilir. */
  setTrack(slot: TrackSlot, track: MediaStreamTrack | null): void {
    void this.senders.get(slot)?.replaceTrack(track);
  }

  close(): void {
    const pc = this.o.pc;
    pc.onnegotiationneeded = null;
    pc.onicecandidate = null;
    pc.ontrack = null;
    pc.onconnectionstatechange = null;
    pc.close();
  }
}
