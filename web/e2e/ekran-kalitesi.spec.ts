import { test, expect, type Page } from "@playwright/test";
import { davetUret, kayitOl } from "./yardim";

/**
 * screen.spec.ts'teki sahteyle ayni fikir, ama 1920x1080: 720p tavani ancak
 * kaynak ondan buyukse gozlenebilir. Sahte kisitlari BILEREK yok sayar; test
 * edilen yol paylasim SURERKEN applyConstraints (gercek Chromium track
 * adapter'i), secicinin ilk istegi degil.
 */
const BUYUK_SAHTE_EKRAN = () => {
  const nav = navigator as unknown as {
    mediaDevices: { getDisplayMedia: (o: unknown) => Promise<MediaStream> };
  };
  nav.mediaDevices.getDisplayMedia = async () => {
    const canvas = document.createElement("canvas");
    canvas.width = 1920; canvas.height = 1080;
    const ciz = canvas.getContext("2d")!;
    setInterval(() => {
      ciz.fillStyle = `hsl(${(Date.now() / 20) % 360} 70% 45%)`;
      ciz.fillRect(0, 0, 1920, 1080);
    }, 33);
    return (canvas as HTMLCanvasElement & { captureStream(f: number): MediaStream })
      .captureStream(60);
  };
};

/** Paylasanin yerel ekran track'inin o anki yakalama boyutu. */
function yakalananYukseklik(page: Page) {
  return page.evaluate(() => {
    const k = window as unknown as { __kovan: { voice: { local: { screenVideo: MediaStreamTrack | null } } } };
    return k.__kovan.voice.local.screenVideo?.getSettings().height ?? null;
  });
}

test("kalite paylasim surerken degisir, izleyici kopma gormez", async ({ browser }) => {
  const damga = Date.now();
  await davetUret(`K1-${damga}`);
  await davetUret(`K2-${damga}`);

  const ctxA = await browser.newContext();
  const ctxB = await browser.newContext();
  await ctxA.addInitScript(BUYUK_SAHTE_EKRAN);
  const a = await ctxA.newPage();
  const b = await ctxB.newPage();

  await kayitOl(a, `K1-${damga}`, `Kaliteci${damga}`);
  await kayitOl(b, `K2-${damga}`, `Seyirci${damga}`);

  await a.getByLabel("Ses kanalına katıl").click();
  await b.getByLabel("Ses kanalına katıl").click();
  await expect(a.getByText("2/4")).toBeVisible();

  // Varsayilan bugunku davranis: Kaynak, 30 fps.
  await a.getByRole("button", { name: "Ekran kalitesi", exact: true }).click();
  await expect(a.getByRole("radio", { name: "Kaynak" })).toHaveAttribute("aria-checked", "true");
  await expect(a.getByRole("radio", { name: "30 fps" })).toHaveAttribute("aria-checked", "true");
  // Esc kapatir.
  await a.keyboard.press("Escape");
  await expect(a.getByRole("radio", { name: "Kaynak" })).toHaveCount(0);

  await a.getByLabel("Ekran paylaş").click();
  await expect(b.locator('[data-kare="ekran"] video')).toBeVisible({ timeout: 15_000 });
  await expect.poll(() => yakalananYukseklik(a), { timeout: 10_000 }).toBe(1080);

  const uzakIz = () => b.evaluate(() => {
    const k = window as unknown as {
      __kovan: { voice: { remote: Map<string, { screenVideo: MediaStreamTrack | null }> } };
    };
    return [...k.__kovan.voice.remote.values()][0]?.screenVideo?.id ?? null;
  });
  const uzakOnce = await uzakIz();
  expect(uzakOnce).not.toBeNull();

  // Paylasim SURERKEN 720p / 60.
  await a.getByRole("button", { name: "Ekran kalitesi", exact: true }).click();
  await a.getByRole("radio", { name: "720p" }).click();
  await a.getByRole("radio", { name: "60 fps" }).click();
  await expect(a.getByRole("radio", { name: "720p" })).toHaveAttribute("aria-checked", "true");
  await expect(a.getByRole("radio", { name: "60 fps" })).toHaveAttribute("aria-checked", "true");

  // Yakalama gercekten tavana indi; ipucu fps'i izledi.
  await expect.poll(() => yakalananYukseklik(a), { timeout: 10_000 }).toBeLessThanOrEqual(720);
  expect(await a.evaluate(() => {
    const k = window as unknown as { __kovan: { voice: { local: { screenVideo: MediaStreamTrack | null } } } };
    return k.__kovan.voice.local.screenVideo?.contentHint;
  })).toBe("motion");

  // Izleyici AYNI track'i gormeye devam ediyor: renegotiation yok, kopma yok.
  expect(await uzakIz()).toBe(uzakOnce);
  await expect(b.getByLabel("ekran paylaşıyor")).toBeVisible();
  await expect(a.getByText("Ekran kalitesi değiştirilemedi.")).toHaveCount(0);

  // Teshis kancasi gercek getStats ciktisini okuyabiliyor. Encoder baslangicta
  // bant genisligi tahminiyle dusuk basladigi icin tam esitlik beklenmez.
  await expect.poll(async () => a.evaluate(async () => {
    const f = (window as unknown as { kovanEkran: () => Promise<{
      izleyiciler: Array<{ giden: { yukseklik: number | null } | null }>;
    }> }).kovanEkran;
    return (await f()).izleyiciler[0]?.giden?.yukseklik ?? null;
  }), { timeout: 20_000 }).toBeGreaterThan(0);
  const giden = await a.evaluate(async () => {
    const f = (window as unknown as { kovanEkran: () => Promise<{
      izleyiciler: Array<{ giden: { yukseklik: number | null; sinir: string | null } | null }>;
    }> }).kovanEkran;
    return (await f()).izleyiciler[0]?.giden;
  });
  expect(giden!.yukseklik!).toBeLessThanOrEqual(720);
  expect(typeof giden!.sinir).toBe("string");

  // Kaynak'a DONUS: applyConstraints kisit setini tumuyle degistirir, eski
  // 720 tavani kalkmali (tasarimda risk 2).
  await a.getByRole("radio", { name: "Kaynak" }).click();
  await expect.poll(() => yakalananYukseklik(a), { timeout: 10_000 }).toBe(1080);
  expect(await uzakIz()).toBe(uzakOnce);

  // Disari tiklama menuyu kapatir.
  await a.locator("header.ust").click();
  await expect(a.getByRole("radio", { name: "Kaynak" })).toHaveCount(0);

  await ctxA.close();
  await ctxB.close();
});
