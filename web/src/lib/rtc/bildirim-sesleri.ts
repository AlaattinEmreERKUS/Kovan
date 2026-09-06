export type BildirimOlayi =
  | "kanala-girdim"
  | "kanaldan-ciktim"
  | "baskasi-girdi"
  | "baskasi-cikti"
  | "mik-kapandi"
  | "mik-acildi"
  | "kulaklik-kapandi"
  | "kulaklik-acildi";

/** Tek nota: frekans (Hz), suresi (saniye), ve tepe seviyenin carpani. */
interface Nota {
  hz: number;
  sure: number;
  /** 1 = tam tepe. Baskasinin olaylari kisik calsin diye var. */
  ses?: number;
}

/**
 * C major pentatonik. Frekanslari elle yazmak yerine dereceden secmek,
 * yeni bir olay eklendiginde tablonun kendiyle uyumlu kalmasini saglar:
 * pentatonikte hangi iki dereceyi yan yana koyarsan koy uyumsuz duyulmaz.
 */
const N = {
  G4: 392.0,
  C5: 523.25,
  D5: 587.33,
  E5: 659.25,
  G5: 783.99,
  A5: 880.0,
} as const;

/** Zarf: ani baslatma "tik" yapar (ses-testi.ts'te ayni sorun ayni cozumle). */
const ATAK_SN = 0.012;
/** Nota bittikten sonraki sonum. Uzun kuyruk sesi "cirpma" degil "can" yapar. */
const KUYRUK_SN = 0.18;
/** Tepe kazanc. 1.0 (GainNode varsayilani) kulakta acitacak kadar yuksek. */
const ZIRVE = 0.12;
/** Sinus: harmonik yok, dolayisiyla tiz batmasi da yok. */
const DALGA: OscillatorType = "sine";

/**
 * Sesler burada VERI olarak durur, kod olarak degil. Ileride hazir ses
 * dosyalarina gecilirse degisen tek yer bu tablo ve `cal` govdesidir.
 */
export const SES_TABLOSU: Record<BildirimOlayi, Nota[]> = {
  "kanala-girdim": [{ hz: N.C5, sure: 0.09 }, { hz: N.G5, sure: 0.11 }],
  "kanaldan-ciktim": [{ hz: N.G5, sure: 0.09 }, { hz: N.C5, sure: 0.11 }],
  "baskasi-girdi": [{ hz: N.E5, sure: 0.07, ses: 0.6 }, { hz: N.A5, sure: 0.09, ses: 0.6 }],
  "baskasi-cikti": [{ hz: N.A5, sure: 0.07, ses: 0.6 }, { hz: N.E5, sure: 0.09, ses: 0.6 }],
  "mik-kapandi": [{ hz: N.G4, sure: 0.09 }],
  "mik-acildi": [{ hz: N.D5, sure: 0.09 }],
  "kulaklik-kapandi": [{ hz: N.D5, sure: 0.07 }, { hz: N.G4, sure: 0.1 }],
  "kulaklik-acildi": [{ hz: N.G4, sure: 0.07 }, { hz: N.D5, sure: 0.1 }],
};

export interface BildirimDeps {
  createAudioContext: () => AudioContext | null;
}

/** Oturumun bildigi yuzey. Testler bunun sahtesini verir. */
export interface Bildirimci {
  cal(olay: BildirimOlayi): void;
  setAcik(acik: boolean): void;
  setCikis(deviceId: string | null): Promise<void>;
}

export class BildirimCalar {
  private ctx: AudioContext | null = null;
  private acik = true;
  private cikis: string | null = null;

  constructor(private o: BildirimDeps) {}

  setAcik(acik: boolean): void {
    this.acik = acik;
  }

  /**
   * `setSinkId` Chromium 110+ eklentisi; desteklenmeyen tarayicida sessizce
   * varsayilan cihazda kalinir. Tercih saklanir, cunku ctx sesler ilk kez
   * calindiginda kuruluyor ve o ana kadar yonlendirilecek bir sey yok.
   */
  async setCikis(deviceId: string | null): Promise<void> {
    this.cikis = deviceId;
    await this.yonlendir();
  }

  private async yonlendir(): Promise<void> {
    const ctx = (this.ctx ??= this.o.createAudioContext());
    const sink = (ctx as { setSinkId?: (id: string) => Promise<void> } | null)?.setSinkId;
    if (!ctx || !sink || this.cikis === null) return;
    try {
      await sink.call(ctx, this.cikis);
    } catch {
      // Cihaz kaybolmus olabilir; bildirim sesi ugruna akisi kirmayiz.
    }
  }

  cal(olay: BildirimOlayi): void {
    if (!this.acik) return;
    const ctx = (this.ctx ??= this.o.createAudioContext());
    if (!ctx) return;

    // Kucuk gecikme: `currentTime` gecmis olabilir, zamanlanan zarf o zaman
    // ilk noktasini atlar ve nota yine dik kenarla baslar.
    let an = ctx.currentTime + 0.02;
    for (const nota of SES_TABLOSU[olay]) {
      this.nota(ctx, nota, an);
      an += nota.sure;
    }
  }

  /**
   * Tek notayi zarfla calar. Zarf sussuz degil ZORUNLU: osilatoru ciplak
   * baglayip `stop` ile kesmek dalgayi dik kenardan koparir, kulak bunu
   * tonun kendisi olarak degil "klik" olarak duyar.
   *
   * Notalar kuyruklari boyunca ust uste biner; ardisik notalar arasindaki
   * sessizligi kaldiran sey budur.
   */
  private nota(ctx: AudioContext, nota: Nota, basla: number): void {
    const osc = ctx.createOscillator();
    const kazanc = ctx.createGain();
    osc.type = DALGA;
    osc.frequency.value = nota.hz;

    // `exponentialRampToValueAtTime` sifiri kabul etmez; 0.0001 (-80 dB)
    // pratikte sessizlik.
    const zirve = ZIRVE * (nota.ses ?? 1);
    const biter = basla + nota.sure + KUYRUK_SN;
    kazanc.gain.setValueAtTime(0.0001, basla);
    kazanc.gain.exponentialRampToValueAtTime(zirve, basla + ATAK_SN);
    kazanc.gain.exponentialRampToValueAtTime(0.0001, biter);

    osc.connect(kazanc);
    kazanc.connect(ctx.destination);
    osc.start(basla);
    osc.stop(biter + 0.02);
  }
}
