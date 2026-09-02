import { test, expect, type Page } from "@playwright/test";
import { baglandi, davetUret, kayitOl } from "./yardim";

/**
 * Bir <video> elementinin GERCEKTEN kare aldigini dogrular. readyState ve
 * videoWidth birlikte bakilir: track bagli ama kare akmiyorsa videoWidth 0
 * kalir ve arayuz sessizce bos siyah kare gosterir.
 */
async function kareAkiyor(page: Page, secici: string) {
  await expect.poll(async () => page.evaluate((s) => {
    const v = document.querySelector<HTMLVideoElement>(s);
    if (!v) return "element-yok";
    return v.videoWidth > 0 && v.readyState >= 2 ? "akiyor" : `bekliyor:${v.videoWidth}/${v.readyState}`;
  }, secici), { timeout: 20_000 }).toBe("akiyor");
}

test("kendi karen aynali akar, karsi taraf duz gorur", async ({ browser }) => {
  const damga = Date.now();
  await davetUret(`K1-${damga}`);
  await davetUret(`K2-${damga}`);

  const ctxA = await browser.newContext();
  const ctxB = await browser.newContext();
  const a = await ctxA.newPage();
  const b = await ctxB.newPage();

  await kayitOl(a, `K1-${damga}`, `Kamera${damga}`);
  await kayitOl(b, `K2-${damga}`, `Izleyen${damga}`);

  await a.getByLabel("Ses kanalına katıl").click();
  await b.getByLabel("Ses kanalına katıl").click();

  // Iki kisi karesi: kendisi + digeri.
  await expect(a.locator('[data-kare="kisi"]')).toHaveCount(2);
  await expect(b.locator('[data-kare="kisi"]')).toHaveCount(2);

  // Kendi karesi her zaman ilk sirada.
  await expect(a.locator('[data-kare="kisi"]').first()).toHaveAttribute("data-kendisi", "true");

  await baglandi(a);
  await baglandi(b);

  // Kamera kapaliyken video yok, harf var.
  await expect(a.locator('[data-kendisi="true"] video')).toHaveCount(0);

  await a.getByLabel("Kamerayı aç").click();

  // A kendi karesinde kendini gorur ve goruntu AYNALI.
  await kareAkiyor(a, '[data-kare="kisi"][data-kendisi="true"] video');
  await expect(a.locator('[data-kare="kisi"][data-kendisi="true"] video')).toHaveClass(/aynali/);

  // B, A'yi gorur ve goruntu DUZ (aynalama yalniz kendi onizlemende).
  const aId = await a.evaluate(() =>
    (window as unknown as { __kovan: { oturum: { o: { selfId: string } } } }).__kovan.oturum.o.selfId);
  await kareAkiyor(b, `[data-kare="kisi"][data-user="${aId}"] video`);
  await expect(b.locator(`[data-kare="kisi"][data-user="${aId}"] video`)).not.toHaveClass(/aynali/);

  // A kamerayi kapatinca iki tarafta da video kaybolur, kare kalir.
  // Uzak tarafta karar sunucunun yaydigi camera bayragindan gelir: uzak
  // track `ended` almaz, yalnizca susar (rtc/session.ts).
  await a.getByLabel("Kamerayı kapat").click();
  await expect(a.locator('[data-kare="kisi"][data-kendisi="true"] video')).toHaveCount(0);
  await expect(b.locator(`[data-kare="kisi"][data-user="${aId}"] video`)).toHaveCount(0, { timeout: 15_000 });
  await expect(b.locator('[data-kare="kisi"]')).toHaveCount(2);

  // A ayrilinca B'nin listesinden duser.
  await a.getByLabel("Odadan ayrıl").click();
  await expect(b.locator('[data-kare="kisi"]')).toHaveCount(1);

  await ctxA.close();
  await ctxB.close();
});
