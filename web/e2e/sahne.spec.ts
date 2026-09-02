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

test("kisi sesi tek tek ayarlanir ve kalici olur", async ({ browser }) => {
  const damga = Date.now();
  await davetUret(`K3-${damga}`);
  await davetUret(`K4-${damga}`);

  const ctxA = await browser.newContext();
  const ctxB = await browser.newContext();
  const a = await ctxA.newPage();
  const b = await ctxB.newPage();

  await kayitOl(a, `K3-${damga}`, `Kisan${damga}`);
  await kayitOl(b, `K4-${damga}`, `Kisilan${damga}`);

  await a.getByLabel("Ses kanalına katıl").click();
  await b.getByLabel("Ses kanalına katıl").click();
  await baglandi(a);

  // Mikser calisiyorsa yedek <audio> HIC olmamali. Ikisi birden calarsa ses
  // iki yoldan gelir: kulaga yanki gibi gelir ve kaydirici hicbir sey
  // yapmaz -- gain 0 olsa bile element sesi devam eder.
  expect(await a.evaluate(() => ({
    mikser: Boolean((window as unknown as {
      __kovan: { voice: { mikMikseri: unknown } };
    }).__kovan.voice.mikMikseri),
    yedekAudio: document.querySelectorAll('audio[data-kovan="yedek"]').length,
  }))).toEqual({ mikser: true, yedekAudio: 0 });

  // Kendi karende ses ayari YOK: kendi sesin zaten calinmiyor.
  const bAd = `Kisilan${damga}`;
  await expect(a.getByLabel(`${bAd} mikrofon seviyesi`)).toHaveCount(1);
  await expect(a.getByLabel(`Kisan${damga} mikrofon seviyesi`)).toHaveCount(0);

  const kaydirici = a.getByLabel(`${bAd} mikrofon seviyesi`);
  await kaydirici.fill("40");

  // Seviye GainNode'a gider (element volume'u degil: 100 ustu ancak boyle).
  const bId = await b.evaluate(() =>
    (window as unknown as { __kovan: { oturum: { o: { selfId: string } } } }).__kovan.oturum.o.selfId);
  expect(await a.evaluate((id) => (window as unknown as {
    __kovan: { voice: { mikMikseri: { volumeOf(u: string): number } } };
  }).__kovan.voice.mikMikseri.volumeOf(id), bId)).toBe(40);

  // Yenilemeden sonra da ayni seviye.
  await a.reload();
  await expect(a.locator("article").first()).toBeVisible({ timeout: 10_000 });
  await a.getByLabel("Ses kanalına katıl").click();
  await expect(a.getByLabel(`${bAd} mikrofon seviyesi`)).toHaveValue("40");

  await ctxA.close();
  await ctxB.close();
});

test("kameralar alani doldurur, kare sayisina gore yayilir", async ({ browser }) => {
  const damga = Date.now();
  await davetUret(`K5-${damga}`);
  await davetUret(`K6-${damga}`);

  const ctxA = await browser.newContext({ viewport: { width: 1280, height: 720 } });
  const ctxB = await browser.newContext();
  const a = await ctxA.newPage();
  const b = await ctxB.newPage();

  await kayitOl(a, `K5-${damga}`, `Genis${damga}`);
  await kayitOl(b, `K6-${damga}`, `Ikinci${damga}`);

  await a.getByLabel("Ses kanalına katıl").click();
  await expect(a.locator('[data-kare="kisi"]')).toHaveCount(1);

  // Tek kare: ana alanin BUYUK bir kismini kaplamali (eskiden 240px'lik
  // minmax yuzunden ustte kucuk duruyordu).
  const tek = await a.locator('[data-kare="kisi"]').boundingBox();
  const alan = await a.locator('[data-alan="ana"]').boundingBox();
  expect(tek!.height).toBeGreaterThan(alan!.height * 0.7);

  // Ikinci kisi girince kareler kuculur ama ikisi de gorunur kalir; alan
  // KAYMAZ (galeri overflow:hidden).
  await b.getByLabel("Ses kanalına katıl").click();
  await expect(a.locator('[data-kare="kisi"]')).toHaveCount(2);
  const kutular = await a.locator('[data-kare="kisi"]').all();
  const olculer = await Promise.all(kutular.map((k) => k.boundingBox()));
  for (const o of olculer) {
    expect(o!.height).toBeGreaterThan(0);
    expect(o!.y + o!.height).toBeLessThanOrEqual(alan!.y + alan!.height + 1);
  }
  // Duzen ALANI DOLDURUR: iki kare de alanin ucte birinden buyuk kalir.
  // Hangi dizilim oldugu alanin oranina bagli (kisa-genis alanda alt alta
  // olmak daha buyuk kare verir) -- karar izgaraOlcusu'nun, birim testi var.
  for (const o of olculer) {
    expect(o!.height).toBeGreaterThan(alan!.height * 0.33);
  }
  // Kareler ust uste binmez.
  const [k1, k2] = olculer.map((o) => o!);
  const ayri = k1.y + k1.height <= k2.y + 1 || k2.y + k2.height <= k1.y + 1
    || k1.x + k1.width <= k2.x + 1 || k2.x + k2.width <= k1.x + 1;
  expect(ayri).toBe(true);

  await ctxA.close();
  await ctxB.close();
});

test("ses ayarlari paneli: esik kalici, kapi giden sesi isliyor", async ({ browser }) => {
  const damga = Date.now();
  await davetUret(`K7-${damga}`);

  const ctx = await browser.newContext();
  const a = await ctx.newPage();
  await kayitOl(a, `K7-${damga}`, `Ayar${damga}`);
  await a.getByLabel("Ses kanalına katıl").click();

  // Kapi giden sesi olcuyor: sahte mikrofon ton uretir, seviye sifir kalmaz.
  await expect.poll(async () => a.evaluate(() => (window as unknown as {
    __kovan: { voice: { girisSeviyesi: number } };
  }).__kovan.voice.girisSeviyesi), { timeout: 10_000 }).toBeGreaterThan(0);

  // Mesh'e giden track HAM mikrofon degil, kapidan cikan track olmali.
  expect(await a.evaluate(() => {
    const o = (window as unknown as { __kovan: { oturum: {
      media: { mic: MediaStreamTrack | null };
      mikIsleyici: { cikis: MediaStreamTrack } | null;
    } } }).__kovan.oturum;
    return Boolean(o.mikIsleyici) && o.mikIsleyici!.cikis !== o.media.mic;
  })).toBe(true);

  await a.getByLabel("Ses ayarları").click();
  const kaydirici = a.getByLabel("Giriş hassasiyeti eşiği");
  await expect(kaydirici).toBeVisible();
  await kaydirici.fill("0.05");

  // Ayar hem store'a hem localStorage'a yazilir.
  expect(await a.evaluate(() => (window as unknown as {
    __kovan: { voice: { sesAyarlari: { esik: number } } };
  }).__kovan.voice.sesAyarlari.esik)).toBeCloseTo(0.05, 3);

  await a.getByLabel("Gürültü bastırma").uncheck();

  await a.reload();
  await expect(a.locator("article").first()).toBeVisible({ timeout: 10_000 });
  await a.getByLabel("Ses kanalına katıl").click();
  await a.getByLabel("Ses ayarları").click();
  await expect(a.getByLabel("Giriş hassasiyeti eşiği")).toHaveValue("0.05");
  await expect(a.getByLabel("Gürültü bastırma")).not.toBeChecked();

  await ctx.close();
});
