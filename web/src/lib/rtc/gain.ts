export const SCREEN_VOLUME_DEFAULT = 100;
export const SCREEN_VOLUME_MAX = 200;

const ANAHTAR = (userId: string) => `screenVolume:${userId}`;

interface Zincir {
  source: MediaStreamAudioSourceNode;
  gain: GainNode;
  /** Chrome hatasi icin gerekli sessiz cikis; asagidaki nota bak. */
  sink: HTMLAudioElement | null;
}

/**
 * Uzak ekran seslerinin karistiricisi. Element `volume`'u KULLANILMAZ: 100
 * ustu yukseltme yalnizca GainNode ile yapilabilir (spec 8.1).
 *
 * Seviye KISIYE OZELDIR: sunucuya yazilmaz, yayinciya bildirilmez, yalnizca
 * bu tarayicida saklanir.
 */
export class ScreenAudioMixer {
  private zincirler = new Map<string, Zincir>();
  private seviyeler = new Map<string, number>();
  private deafened = false;

  constructor(
    private ctx: AudioContext,
    private storage: Storage = localStorage,
    /** Node testinde MediaStream yok; disaridan verilebilir. */
    private makeStream: (t: MediaStreamTrack) => MediaStream = (t) => new MediaStream([t]),
  ) {}

  attach(userId: string, track: MediaStreamTrack): void {
    this.detach(userId);
    const stream = this.makeStream(track);
    const source = this.ctx.createMediaStreamSource(stream);
    const gain = this.ctx.createGain();
    source.connect(gain);
    gain.connect(this.ctx.destination);

    // Chrome'da uzak bir MediaStream, bir HTMLMediaElement'e atanmadan Web
    // Audio grafigine VERI AKITMAZ. Element sessize alinir; duyulan ses
    // GainNode'dan gelir.
    let sink: HTMLAudioElement | null = null;
    if (typeof document !== "undefined") {
      sink = document.createElement("audio");
      sink.srcObject = stream;
      sink.muted = true;
      void sink.play().catch(() => {});
    }

    this.zincirler.set(userId, { source, gain, sink });
    this.uygula(userId);
  }

  detach(userId: string): void {
    const z = this.zincirler.get(userId);
    if (!z) return;
    z.source.disconnect();
    z.gain.disconnect();
    if (z.sink) {
      z.sink.srcObject = null;
      z.sink.remove();
    }
    this.zincirler.delete(userId);
  }

  volumeOf(userId: string): number {
    const bellekte = this.seviyeler.get(userId);
    if (bellekte !== undefined) return bellekte;
    const ham = this.storage.getItem(ANAHTAR(userId));
    const sayi = ham === null ? NaN : Number(ham);
    const seviye = Number.isFinite(sayi) ? this.kirp(sayi) : SCREEN_VOLUME_DEFAULT;
    this.seviyeler.set(userId, seviye);
    return seviye;
  }

  setVolume(userId: string, value: number): void {
    const seviye = this.kirp(value);
    this.seviyeler.set(userId, seviye);
    try {
      this.storage.setItem(ANAHTAR(userId), String(seviye));
    } catch {
      // Gizli sekmede localStorage yazmaya kapali olabilir; ses yine calisir.
    }
    this.uygula(userId);
  }

  setDeafened(deafened: boolean): void {
    this.deafened = deafened;
    for (const userId of this.zincirler.keys()) this.uygula(userId);
  }

  close(): void {
    for (const userId of [...this.zincirler.keys()]) this.detach(userId);
  }

  private uygula(userId: string): void {
    const z = this.zincirler.get(userId);
    if (!z) return;
    z.gain.gain.value = this.deafened ? 0 : this.volumeOf(userId) / 100;
  }

  private kirp(v: number): number {
    return Math.min(SCREEN_VOLUME_MAX, Math.max(0, Math.round(v)));
  }
}
