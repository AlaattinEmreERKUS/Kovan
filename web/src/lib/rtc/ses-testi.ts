/** Bip suresi. Kisa tutulur: test bir uyari degil, bir dogrulama. */
const BIP_SN = 0.15;
const BIP_HZ = 660;
/** Zarf: ani baslatma "tik" yapar (mikrofon.ts'te ayni sorun ayni cozumle). */
const ZARF_SN = 0.01;

/**
 * pointerup pencere disinda kaybolabilir. Tavan olmadan geri dinleme sonsuza
 * kadar acik kalir ve hoparlordeki kullanici geri besleme cigligi duyar.
 */
export const GERI_DINLEME_TAVAN_MS = 30_000;

/**
 * Ses ayarlari panelinin test araci.
 *
 * Oturumun AudioContext'ini ODUNC ALIR, kendi context'ini ACMAZ: cikis cihazi
 * zaten o context'te ayarli oldugu icin bip ve geri dinleme secili kulakliktan
 * duyulur. Kendi context'imizi acsaydik sinkId'yi ikinci kez yonetmek ve iki
 * ayri cihaza calma riskini tasimak gerekirdi.
 */
export class SesTestcisi {
  private kaynak: MediaStreamAudioSourceNode | null = null;
  private gain: GainNode | null = null;
  private zamanlayici: ReturnType<typeof setTimeout> | null = null;

  constructor(
    private ctx: AudioContext,
    private makeStream: (t: MediaStreamTrack) => MediaStream = (t) => new MediaStream([t]),
  ) {}

  bip(): void {
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.frequency.value = BIP_HZ;
    osc.connect(gain);
    gain.connect(this.ctx.destination);

    const t0 = this.ctx.currentTime;
    gain.gain.setTargetAtTime(0.2, t0, ZARF_SN);
    gain.gain.setTargetAtTime(0, t0 + BIP_SN, ZARF_SN);
    osc.start(t0);
    osc.stop(t0 + BIP_SN + ZARF_SN * 4);
  }

  /**
   * Verilen track'i kullanicinin kendi kulagina calar. Cagiran, oturumun
   * KAPIDAN GECMIS cikis track'ini verir: karsi tarafin duydugu ses budur,
   * ham mikrofon degil.
   */
  geriDinlemeBasla(track: MediaStreamTrack): void {
    if (this.kaynak) return;   // basili tutma tekrar tetikleyebilir
    this.kaynak = this.ctx.createMediaStreamSource(this.makeStream(track));
    this.gain = this.ctx.createGain();
    this.kaynak.connect(this.gain);
    this.gain.connect(this.ctx.destination);
    this.zamanlayici = setTimeout(() => this.geriDinlemeBitir(), GERI_DINLEME_TAVAN_MS);
  }

  geriDinlemeBitir(): void {
    if (this.zamanlayici !== null) {
      clearTimeout(this.zamanlayici);
      this.zamanlayici = null;
    }
    this.kaynak?.disconnect();
    this.gain?.disconnect();
    this.kaynak = null;
    this.gain = null;
  }

  /** Context ODUNC: kapatilmaz. Kapatirsak oturumun tum sesi olur. */
  kapat(): void {
    this.geriDinlemeBitir();
  }
}
