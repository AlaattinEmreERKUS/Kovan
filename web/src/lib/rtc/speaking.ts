/** Ortalama karekok genlik. 0 = sessizlik. */
export function rmsOf(buffer: Float32Array<ArrayBufferLike>): number {
  let toplam = 0;
  for (const x of buffer) toplam += x * x;
  return Math.sqrt(toplam / buffer.length);
}

export interface SpeakingOptions {
  ctx: AudioContext;
  /** Varsayilan esik. */
  threshold?: number;
  onChange(userId: string, speaking: boolean): void;
  /** Node testinde MediaStream yok; disaridan verilebilir. */
  makeStream?(track: MediaStreamTrack): MediaStream;
}

interface Izleme {
  analyser: AnalyserNode;
  source: MediaStreamAudioSourceNode;
  /** Kaynagi biz mi actik: mikserden odunc alinan kaynak KAPATILMAZ. */
  sahip: boolean;
  /** getFloatTimeDomainData ArrayBuffer destekli tampon istiyor. */
  buffer: Float32Array<ArrayBuffer>;
  speaking: boolean;
}

const ARALIK = 100;

/**
 * Konusma algilama YEREL bir olcumdur; sunucuya paket gitmez. Her mikrofon
 * orneginde voice.state yayinlamak gunluk 100.000 istek kotasini dakikalar
 * icinde bitirirdi.
 */
export class SpeakingDetector {
  private izlemeler = new Map<string, Izleme>();
  private zamanlayici: ReturnType<typeof setInterval> | null = null;

  constructor(private o: SpeakingOptions) {}

  /** Kendi mikrofonun gibi, baska kimsenin kullanmadigi bir track icin. */
  watch(userId: string, track: MediaStreamTrack): void {
    const stream = (this.o.makeStream ?? ((t: MediaStreamTrack) => new MediaStream([t])))(track);
    this.baglan(userId, this.o.ctx.createMediaStreamSource(stream), true);
  }

  /**
   * Zaten acik bir kaynagi PAYLASARAK izler.
   *
   * Ayni track icin ayni AudioContext'te ikinci bir MediaStreamAudioSource
   * acmak Chrome'da ikincisine SESSIZLIK verir: uzak mikrofonlar mikserden
   * gectikten sonra gosterge tam olarak boyle oldu -- ses duyuluyor, ham
   * RMS 0.3 okunuyor, ama gostergenin analyser'i sifir goruyordu.
   */
  watchSource(userId: string, source: MediaStreamAudioSourceNode): void {
    this.baglan(userId, source, false);
  }

  private baglan(userId: string, source: MediaStreamAudioSourceNode, sahip: boolean): void {
    this.unwatch(userId);
    const analyser = this.o.ctx.createAnalyser();
    analyser.fftSize = 2048;
    source.connect(analyser);
    // Analyser destination'a BAGLANMAZ: baglanirsa kendi sesimiz hoparlorden
    // geri caliniyor ve mesh'e yanki olarak donuyor.
    this.izlemeler.set(userId, {
      analyser, source, sahip, buffer: new Float32Array(analyser.fftSize), speaking: false,
    });
    this.basla();
  }

  unwatch(userId: string): void {
    const izleme = this.izlemeler.get(userId);
    if (!izleme) return;
    // Odunc kaynak mikserin: disconnect edersek sesi de keseriz. Yalnizca
    // kendi analyser baglantimizi cozeriz.
    if (izleme.sahip) izleme.source.disconnect();
    else izleme.source.disconnect(izleme.analyser);
    izleme.analyser.disconnect();
    this.izlemeler.delete(userId);
    if (this.izlemeler.size === 0) this.dur();
  }

  stop(): void {
    for (const id of [...this.izlemeler.keys()]) this.unwatch(id);
    this.dur();
  }

  private basla(): void {
    if (this.zamanlayici !== null) return;
    this.zamanlayici = setInterval(() => this.ornekle(), ARALIK);
  }

  private dur(): void {
    if (this.zamanlayici === null) return;
    clearInterval(this.zamanlayici);
    this.zamanlayici = null;
  }

  private ornekle(): void {
    const esik = this.o.threshold ?? 0.02;
    for (const [userId, izleme] of this.izlemeler) {
      izleme.analyser.getFloatTimeDomainData(izleme.buffer);
      const konusuyor = rmsOf(izleme.buffer) > esik;
      // Yalnizca DEGISIMDE olay yayilir: her 100 ms'de bir store yazmak tum
      // uye listesini yeniden cizdirirdi.
      if (konusuyor === izleme.speaking) continue;
      izleme.speaking = konusuyor;
      this.o.onChange(userId, konusuyor);
    }
  }
}
