import { expect, type Page } from "@playwright/test";

export const API = "http://127.0.0.1:8787";

/** wrangler dev üzerinde çalışan DO'ya doğrudan davet ekler. */
export async function davetUret(kod: string) {
  const res = await fetch(`${API}/api/dev/invite`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ code: kod }),
  });
  expect(res.ok).toBeTruthy();
}

/**
 * Davet koduyla kayit olur ve sohbet ekranini bekler.
 *
 * Kayit formuna gecis POLL ile yapilir: SSR ciktisi hemen gorunur ama
 * hidrasyon bitmeden yapilan tiklama HICBIR SEY yapmaz ve Playwright bunu
 * hata saymaz -- test 30 sn sonra "Davet kodu alani yok" diye duserdi.
 * Tiklama yalniz form henuz acilmamissa tekrarlanir ve gecis dugmesi TAM
 * adiyla secilir; "Kayıt ol" ile biten regex gonderme dugmesine de uyar.
 */
export async function kayitOl(page: Page, kod: string, kullanici: string) {
  await page.goto("/giris");
  const kodAlani = page.getByPlaceholder("Davet kodu");
  await expect.poll(async () => {
    if (await kodAlani.isVisible()) return true;
    await page.getByRole("button", { name: "Davet kodun mu var? Kayıt ol" }).click();
    return kodAlani.isVisible();
  }, { timeout: 20_000, message: "kayit formu acilmadi" }).toBe(true);

  await kodAlani.fill(kod);
  await page.getByPlaceholder("Görünen ad").fill(kullanici);
  await page.getByPlaceholder("Kullanıcı adı").fill(kullanici.toLowerCase());
  await page.getByPlaceholder("Parola").fill("kovan123");
  await page.getByRole("button", { name: "Kayıt ol", exact: true }).click();
  await expect(page.getByRole("log")).toBeVisible();
}

/** Sayfadaki tum RTCPeerConnection'lar connected olana kadar bekler. */
export async function baglandi(page: Page) {
  await expect.poll(async () => page.evaluate(() => {
    const k = (window as unknown as { __kovan?: { oturum: unknown } }).__kovan;
    if (!k) return "kanca-yok";
    const mesh = (k.oturum as { mesh?: { peers: Map<string, { o: { pc: RTCPeerConnection } }> } }).mesh;
    if (!mesh || mesh.peers.size === 0) return "peer-yok";
    return [...mesh.peers.values()].map((p) => p.o.pc.connectionState).join(",");
  }), { timeout: 25_000 }).toBe("connected");
}

