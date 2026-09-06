import { describe, it, expect, vi } from "vitest";
import { BildirimCalar } from "./bildirim-sesleri";
import { sahteCtx } from "./test-destek";

/** Sahte GainNode: zarf cagrilari burada birikir. */
interface SahteKazanc {
  gain: {
    setValueAtTime: ReturnType<typeof vi.fn>;
    exponentialRampToValueAtTime: ReturnType<typeof vi.fn>;
  };
}

/** Her notanin atak rampasinin hedefi: duyulan tepe seviye. */
function zirveler(kazanclar: SahteKazanc[]): number[] {
  return kazanclar.map(
    (k) => k.gain.exponentialRampToValueAtTime.mock.calls[0][0] as number,
  );
}

function kur() {
  const ctx = sahteCtx();
  const calar = new BildirimCalar({ createAudioContext: () => ctx });
  const osilatorler = () =>
    (ctx.createOscillator as ReturnType<typeof vi.fn>).mock.results.map(
      (r) => r.value as { frequency: { value: number } },
    );
  const kazanclar = () =>
    (ctx.createGain as ReturnType<typeof vi.fn>).mock.results.map(
      (r) => r.value as SahteKazanc,
    );
  return { calar, ctx, osilatorler, kazanclar };
}

describe("bildirim calar", () => {
  it("kanala girme sesi yukselen iki nota calar", () => {
    const { calar, osilatorler } = kur();

    calar.cal("kanala-girdim");

    // Birebir Hz degil yon dogrulanir: tonlar kulak icin ayarlanabilir,
    // "girerken yukselir, cikarken alcalir" ayarlanamaz.
    const hz = osilatorler().map((o) => o.frequency.value);
    expect(hz).toHaveLength(2);
    expect(hz[1]).toBeGreaterThan(hz[0]);
  });

  it("cikma sesi ayni notalari ters sirada calar", () => {
    const { calar, osilatorler } = kur();

    calar.cal("kanaldan-ciktim");

    const hz = osilatorler().map((o) => o.frequency.value);
    expect(hz[1]).toBeLessThan(hz[0]);
  });

  it("her nota zarfla calar, ciplak tam seviyede degil", () => {
    const { calar, kazanclar } = kur();

    calar.cal("mik-acildi");

    // Zarfsiz calmak dalgayi dik kenardan koparir ve "klik" duyulur.
    const g = kazanclar()[0].gain;
    expect(g.setValueAtTime).toHaveBeenCalled();
    expect(g.exponentialRampToValueAtTime).toHaveBeenCalledTimes(2); // atak + sonum
    const zirve = g.exponentialRampToValueAtTime.mock.calls[0][0] as number;
    expect(zirve).toBeGreaterThan(0);
    expect(zirve).toBeLessThan(0.3); // GainNode varsayilani 1.0: kulakta acitir
  });

  it("baskasinin olayi kendi olayindan kisik calar", () => {
    const { calar, kazanclar } = kur();

    calar.cal("kanala-girdim");
    const kendi = zirveler(kazanclar())[0];
    calar.cal("baskasi-girdi");
    const digeri = zirveler(kazanclar()).at(-1)!;

    expect(digeri).toBeLessThan(kendi);
  });

  it("kapatilinca hicbir ses uretilmez", () => {
    const { calar, osilatorler } = kur();

    calar.setAcik(false);
    calar.cal("kanala-girdim");

    expect(osilatorler()).toEqual([]);
  });

  it("secili cikis cihazina yonlendirilir", async () => {
    const { calar, ctx } = kur();

    await calar.setCikis("kulaklik-1");

    expect(ctx.setSinkId).toHaveBeenCalledWith("kulaklik-1");
  });
});
