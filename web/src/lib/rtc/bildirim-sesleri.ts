export type BildirimOlayi =
  | "kanala-girdim"
  | "kanaldan-ciktim"
  | "baskasi-girdi"
  | "baskasi-cikti"
  | "mik-kapandi"
  | "mik-acildi"
  | "kulaklik-kapandi"
  | "kulaklik-acildi";

/** Tek nota: frekans (Hz) ve suresi (saniye). */
interface Nota {
  hz: number;
  sure: number;
}

/**
 * Sesler burada VERI olarak durur, kod olarak degil. Ileride hazir ses
 * dosyalarina gecilirse degisen tek yer bu tablo ve `cal` govdesidir.
 */
export const SES_TABLOSU: Record<BildirimOlayi, Nota[]> = {
  "kanala-girdim": [{ hz: 440, sure: 0.08 }, { hz: 660, sure: 0.1 }],
  "kanaldan-ciktim": [{ hz: 660, sure: 0.08 }, { hz: 440, sure: 0.1 }],
  "baskasi-girdi": [{ hz: 520, sure: 0.06 }, { hz: 520, sure: 0.06 }],
  "baskasi-cikti": [{ hz: 390, sure: 0.06 }, { hz: 390, sure: 0.06 }],
  "mik-kapandi": [{ hz: 300, sure: 0.07 }],
  "mik-acildi": [{ hz: 500, sure: 0.07 }],
  "kulaklik-kapandi": [{ hz: 300, sure: 0.07 }, { hz: 220, sure: 0.09 }],
  "kulaklik-acildi": [{ hz: 220, sure: 0.07 }, { hz: 400, sure: 0.09 }],
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

    let an = ctx.currentTime;
    for (const nota of SES_TABLOSU[olay]) {
      const osc = ctx.createOscillator();
      const kazanc = ctx.createGain();
      osc.frequency.value = nota.hz;
      osc.connect(kazanc);
      kazanc.connect(ctx.destination);
      osc.start(an);
      osc.stop(an + nota.sure);
      an += nota.sure;
    }
  }
}
