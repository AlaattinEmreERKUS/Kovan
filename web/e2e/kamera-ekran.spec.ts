import { test, expect } from "@playwright/test";
import { baglandi, davetUret, kayitOl } from "./yardim";

/** screen.spec.ts'teki ile ayni sahte yakalayici. */
const SAHTE_EKRAN = () => {
  const nav = navigator as unknown as {
    mediaDevices: { getDisplayMedia: (o: unknown) => Promise<MediaStream> };
  };
  nav.mediaDevices.getDisplayMedia = async () => {
    const canvas = document.createElement("canvas");
    canvas.width = 640; canvas.height = 360;
    const ciz = canvas.getContext("2d")!;
    setInterval(() => {
      ciz.fillStyle = `hsl(${(Date.now() / 20) % 360} 70% 45%)`;
      ciz.fillRect(0, 0, 640, 360);
    }, 100);
    return (canvas as HTMLCanvasElement & { captureStream(f: number): MediaStream })
      .captureStream(30);
  };
};

test("kamera ve ekran AYNI ANDA yasar, ekran kapaninca kamera geri gelir", async ({ browser }) => {
  const damga = Date.now();
  await davetUret(`KE1-${damga}`);
  await davetUret(`KE2-${damga}`);

  const ctxA = await browser.newContext();
  const ctxB = await browser.newContext();
  await ctxA.addInitScript(SAHTE_EKRAN);
  const a = await ctxA.newPage();
  const b = await ctxB.newPage();

  await kayitOl(a, `KE1-${damga}`, `Paylasan${damga}`);
  await kayitOl(b, `KE2-${damga}`, `Izleyen${damga}`);

  await a.getByLabel("Ses kanalına katıl").click();
  await b.getByLabel("Ses kanalına katıl").click();
  await baglandi(a);

  const aId = await a.evaluate(() =>
    (window as unknown as { __kovan: { oturum: { o: { selfId: string } } } }).__kovan.oturum.o.selfId);

  // 1) Once kamera: iki tarafta da goruntu akar.
  await a.getByLabel("Kamerayı aç").click();
  await expect(a.locator('[data-kare="kisi"][data-kendisi="true"] video')).toBeVisible();
  await expect(b.locator(`[data-kare="kisi"][data-user="${aId}"] video`)).toBeVisible({ timeout: 15_000 });

  // 2) Ustune ekran: KAMERA KAYBOLMAMALI, kendi ekranini da gormelisin.
  await a.getByLabel("Ekran paylaş").click();
  await expect(a.locator(`[data-kare="ekran"][data-user="${aId}"] video`)).toBeVisible({ timeout: 15_000 });
  await expect(a.locator('[data-kare="kisi"][data-kendisi="true"] video')).toBeVisible();
  await expect(b.locator(`[data-kare="ekran"][data-user="${aId}"] video`)).toBeVisible({ timeout: 15_000 });
  await expect(b.locator(`[data-kare="kisi"][data-user="${aId}"] video`)).toBeVisible();

  // 3) Ekrani kapat: kamera kareleri geri gelir.
  await a.getByRole("status").getByRole("button", { name: "Durdur", exact: true }).click();
  await expect(a.locator('[data-kare="ekran"]')).toHaveCount(0, { timeout: 15_000 });
  await expect(a.locator('[data-kare="kisi"][data-kendisi="true"] video')).toBeVisible();
  await expect(b.locator(`[data-kare="kisi"][data-user="${aId}"] video`)).toBeVisible({ timeout: 15_000 });

  await ctxA.close();
  await ctxB.close();
});
