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

/** Giden ekran akisinin GERCEK durumu; secilen kalite yalniz tavandir. */
export interface EkranOzeti {
  genislik: number | null;
  yukseklik: number | null;
  fps: number | null;
  /** "none" | "bandwidth" | "cpu" | "other": encoder neden secimin altinda. */
  sinir: string | null;
}

export interface SignalPayload {
  description?: RTCSessionDescriptionInit;
  candidate?: RTCIceCandidateInit | null;
}

/**
 * "failed" durumunda kac kez ICE yeniden baslatilir. Sinirsiz denemek,
 * TURN'un gercekten ulasilamadigi durumda (kota bitti, ag engelli) sonsuz
 * offer uretir. Basarili baglanti sayaci sifirlar.
 */
const ICE_DENEME_HAKKI = 3;

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
  private iceDenemesi = 0;
  /** Sender'lar hazir olmadan gelen track'ler; adopt() sonrasi uygulanir. */
  private pending = new Map<TrackSlot, MediaStreamTrack | null>();

  constructor(private o: PeerOptions) {
    const pc = o.pc;
    // Transceiver'lari YALNIZCA impolite taraf acar. Iki taraf da acarsa
    // Chrome, cevap veren tarafin onceden actiklarini uzak m-line'lara
    // ESLEMIYOR: kendi dordu mid=null kalirken offer icin dort YENI
    // transceiver aciliyor. Sonuc 8 transceiver, uzak track'ler 4-7
    // indekslerinde ve SLOT_ORDER eslemesi cokuyor (Task 13'te olculdu).
    // Polite taraf offer gelince adopt() ile uzaktan doganlari benimser.
    if (!o.polite) {
      for (const slot of SLOT_ORDER) {
        const tr = pc.addTransceiver(SLOT_KIND[slot], { direction: "sendrecv" });
        this.senders.set(slot, tr.sender);
      }
    }

    pc.onnegotiationneeded = async () => {
      // Baslangic offer'ini YALNIZCA impolite taraf uretir. Iki taraf da
      // offer uretirse polite tarafin onceden actigi dort transceiver
      // eslesmeye giremiyor ve uzak m-line'lar icin YENI transceiver'lar
      // aciliyor: 8 transceiver, uzak track'ler 4-7 indekslerinde, SLOT_ORDER
      // eslemesi coker ve ontrack sessizce doner. Olculdu (Task 13 teshisi).
      //
      // Normal akista renegotiation olmaz: dort transceiver sabit, track
      // degisimi replaceTrack ile yapiliyor ve o negotiation tetiklemiyor.
      // TEK istisna restartIce(): koptuktan sonra yeni ICE kimlik bilgisiyle
      // yeni bir offer uretmek icin bilerek buraya girer.
      if (this.o.polite) return;
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

    pc.onconnectionstatechange = () => {
      const durum = pc.connectionState;
      // Yol yeniden kuruldu; sonraki kopma icin hak tazelenir.
      if (durum === "connected") this.iceDenemesi = 0;
      // ICE yolu kalici olarak dustu. Kurtarma yoksa baglanti olu kalir ve
      // iki taraf da birbirini seste gorurken sessizce bekler -- ag gidip
      // gelen kullanicida gozlenen tam olarak buydu.
      //
      // YALNIZCA impolite taraf dener: restartIce() negotiationneeded
      // tetikler ve o isleyici zaten polite tarafta erken doner. Iki taraf da
      // denerse ayni anda offer uretilir ve cakisma buyur.
      if (durum === "failed" && !this.o.polite && this.iceDenemesi < ICE_DENEME_HAKKI) {
        this.iceDenemesi++;
        pc.restartIce();
      }
      o.onStateChange?.(durum);
    };
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
        // Benimseme setRemoteDescription ile setLocalDescription ARASINDA
        // olmali: yonu burada sendrecv yapinca cevap da sendrecv cikar.
        if (this.o.polite && this.senders.size === 0) this.adopt();
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
    this.pending.set(slot, track);
    const sender = this.senders.get(slot);
    // Polite tarafta sender'lar offer gelene kadar yok; track adopt() sonrasi
    // uygulanir. Kaydetmezsek katilan kisi hic ses gondermez.
    if (sender) void sender.replaceTrack(track);
  }

  /**
   * Polite taraf: uzak offer'in acdigi transceiver'lari yuvalara baglar ve
   * yonlerini sendrecv yapar. Sira uzak m-line sirasidir, yani SLOT_ORDER.
   */
  private adopt(): void {
    const trs = this.o.pc.getTransceivers();
    SLOT_ORDER.forEach((slot, i) => {
      const tr = trs[i];
      if (!tr) return;
      tr.direction = "sendrecv";
      this.senders.set(slot, tr.sender);
    });
    for (const [slot, track] of this.pending) {
      void this.senders.get(slot)?.replaceTrack(track);
    }
  }

  /**
   * Yalniz OKUR, negotiation'a dokunmaz. Teshis araci oldugu icin hicbir
   * kosulda hata firlatmaz: paylasim yoksa, sender henuz yoksa (polite taraf,
   * adopt oncesi) ya da encoder ilk kareyi uretmediyse null doner.
   */
  async ekranIstatistigi(): Promise<EkranOzeti | null> {
    const sender = this.senders.get("screenVideo");
    if (!sender?.track) return null;
    try {
      const rapor = await sender.getStats();
      for (const s of rapor.values()) {
        if (s.type !== "outbound-rtp" || s.kind !== "video") continue;
        return {
          genislik: s.frameWidth ?? null,
          yukseklik: s.frameHeight ?? null,
          fps: s.framesPerSecond ?? null,
          sinir: s.qualityLimitationReason ?? null,
        };
      }
      return null;
    } catch {
      return null;
    }
  }

  /**
   * TURN credential yenilendi. Yol ve m-line'lar degismez; yalnizca bir
   * sonraki ICE toplamasinin kullanacagi kimlik bilgisi tazelenir.
   */
  setIceServers(iceServers: RTCIceServer[]): void {
    this.o.pc.setConfiguration({ iceServers });
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
