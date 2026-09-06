import { describe, it, expect, vi } from "vitest";
import { BildirimCalar } from "./bildirim-sesleri";
import { sahteCtx } from "./test-destek";

function kur() {
  const ctx = sahteCtx();
  const calar = new BildirimCalar({ createAudioContext: () => ctx });
  const osilatorler = () =>
    (ctx.createOscillator as ReturnType<typeof vi.fn>).mock.results.map(
      (r) => r.value as { frequency: { value: number } },
    );
  return { calar, ctx, osilatorler };
}

describe("bildirim calar", () => {
  it("kanala girme sesi yukselen iki nota calar", () => {
    const { calar, osilatorler } = kur();

    calar.cal("kanala-girdim");

    expect(osilatorler().map((o) => o.frequency.value)).toEqual([440, 660]);
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
