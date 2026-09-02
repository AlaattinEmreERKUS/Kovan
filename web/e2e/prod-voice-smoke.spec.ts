import { test, expect } from "@playwright/test";

/**
 * Canli duman testi. Mevcut prod-smoke.spec.ts gibi ayri config ile kosulur ve
 * varsayilan calistirmadan haric tutulur (playwright.config.ts testIgnore).
 *
 * Gercek kullanici olusturmaz: canli davet kodu gerektirir. Yalnizca canli
 * uclarin ayakta oldugunu ve TURN ucunun yetki istedigini dogrular.
 */
const WORKER = "https://kovan.emrerkus23.workers.dev";
const WEB = "https://kovan-web.pages.dev";

test("canli saglik ucu cevap veriyor", async ({ request }) => {
  const res = await request.get(`${WORKER}/health`);
  expect(res.ok()).toBeTruthy();
  expect(await res.json()).toEqual({ ok: true });
});

test("canli TURN ucu yetki istiyor", async ({ request }) => {
  const yetkisiz = await request.get(`${WORKER}/api/turn`);
  expect(yetkisiz.status()).toBe(401);

  const uydurma = await request.get(`${WORKER}/api/turn?token=uydurma`);
  expect(uydurma.status()).toBe(401);
});

test("canli web giris sayfasi aciliyor ve ses kanali arayuzu yuklu", async ({ page }) => {
  await page.goto(`${WEB}/giris`);
  await expect(page.getByPlaceholder("Kullanıcı adı")).toBeVisible();
  // Kayit moduna gecis calisiyor: hidrasyon tamam demektir.
  await page.getByRole("button", { name: /Kayıt ol$/ }).click();
  await expect(page.getByPlaceholder("Davet kodu")).toBeVisible();
});
