export const SES_VARSAYILAN = 100;
export const SES_MAKS = 200;

interface Zincir {
  source: MediaStreamAudioSourceNode;
  gain: GainNode;
  /** Chrome hatasi icin gerekli sessiz cikis; asagidaki nota bak. */
  sink: HTMLAudioElement | null;
}

/**
 * Uzak seslerin karistiricisi. Element `volume`'u KULLANILMAZ: 100 ustu
 * yukseltme yalnizca GainNode ile yapilabilir (spec 8.1).
 *
 * Ayni sinif iki yerde kullaniliyor: paylasilan ekranin sesi ve kisilerin
 * mikrofonu. Ayiran tek sey `onek` -- seviyeler ayri anahtarlarda saklanir,
 * yani birinin ekran sesini kismak mikrofonunu kismaz.
 *
 * Seviye KISIYE OZELDIR: sunucuya yazilmaz, karsi tarafa bildirilmez,
 * yalnizca bu tarayicida saklanir.
 */
export class RemoteAudioMixer {
  private zincirler = new Map<string, Zincir>();
  private seviyeler = new Map<string, number>();
  private deafened = false;

  constructor(
    private ctx: AudioContext,
    /** localStorage anahtar oneki: "screenVolume" | "micVolume". */
    private onek: string,
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
    //
    // Element BELGEYE EKLENIR: yalnizca createElement ile birakildiginda
    // veri pompalamasi garanti degil. Uzak mikrofonlar yedek <audio>
    // yolundan cikarilinca konusma gostergesi oldu -- analyser sifir
    // okuyordu, yani track hicbir elementte calmadigi icin akmiyordu.
    let sink: HTMLAudioElement | null = null;
    if (typeof document !== "undefined") {
      sink = document.createElement("audio");
      sink.srcObject = stream;
      sink.muted = true;
      sink.style.display = "none";
      // Isaret: teshiste ve testte mikserin sessiz pompasi ile RemoteAudio'nun
      // yedek (DUYULAN) elementi karistirilmasin.
      sink.dataset.kovan = "mikser";
      document.body.appendChild(sink);
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

  /**
   * Bu kisinin acik kaynak dugumu. Konusma gostergesi kendi kaynagini
   * acamaz (Chrome ayni track icin ikinci kaynaga sessizlik verir), bu
   * yuzden buradakini odunc alir.
   */
  sourceOf(userId: string): MediaStreamAudioSourceNode | null {
    return this.zincirler.get(userId)?.source ?? null;
  }

  volumeOf(userId: string): number {
    const bellekte = this.seviyeler.get(userId);
    if (bellekte !== undefined) return bellekte;
    const ham = this.storage.getItem(this.anahtar(userId));
    const sayi = ham === null ? NaN : Number(ham);
    const seviye = Number.isFinite(sayi) ? this.kirp(sayi) : SES_VARSAYILAN;
    this.seviyeler.set(userId, seviye);
    return seviye;
  }

  setVolume(userId: string, value: number): void {
    const seviye = this.kirp(value);
    this.seviyeler.set(userId, seviye);
    try {
      this.storage.setItem(this.anahtar(userId), String(seviye));
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
    return Math.min(SES_MAKS, Math.max(0, Math.round(v)));
  }

  private anahtar(userId: string): string {
    return `${this.onek}:${userId}`;
  }
}

/** Paylasilan ekranin sesi. */
export function ekranMikseri(
  ctx: AudioContext,
  storage?: Storage,
  makeStream?: (t: MediaStreamTrack) => MediaStream,
): RemoteAudioMixer {
  return new RemoteAudioMixer(ctx, "screenVolume", storage, makeStream);
}

/**
 * Kisilerin mikrofonu. Uzak mikrofonlar bu miksere baglandiktan sonra ayrica
 * bir <audio> elementinden CALINMAZ; iki yol birden acik kalirsa ses cift
 * duyulur (RemoteAudio.svelte bu yuzden yalniz mikser yokken devreye girer).
 */
export function mikrofonMikseri(
  ctx: AudioContext,
  storage?: Storage,
  makeStream?: (t: MediaStreamTrack) => MediaStream,
): RemoteAudioMixer {
  return new RemoteAudioMixer(ctx, "micVolume", storage, makeStream);
}
