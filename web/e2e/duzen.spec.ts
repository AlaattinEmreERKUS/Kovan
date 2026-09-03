import { test, expect } from "@playwright/test";
import { davetUret, kayitOl } from "./yardim";

/**
 * Duzen kapisi: uc sutun (kanallar, sohbet, uyeler) KENDI icinde kayar,
 * sayfa govdesi HIC kaymaz.
 *
 * Hata su sekilde gorunuyordu: uye listesi uzayinca `aside` 100vh'yi
 * tasiriyor, gorunum penceresi asagi kayiyor ve kanal rayi ile sohbet
 * ekrandan cikiyordu. Yani "asagidaki uyeye bakmak" sohbeti kaybettiriyordu.
 *
 * Kucuk gorunum penceresi bilerek: az sayida uyeyle ayni tasma kosulunu
 * uretir, testin yuzlerce hesap acmasi gerekmez.
 */
test("dar ekranda sutunlar kendi icinde kayar, sayfa govdesi kaymaz", async ({ browser }) => {
  const damga = Date.now();
  await davetUret(`D1-${damga}`);

  const ctx = await browser.newContext({ viewport: { width: 900, height: 240 } });
  const p = await ctx.newPage();
  await kayitOl(p, `D1-${damga}`, `Duzen${damga}`);

  // 1. Govde kaymaz: dikey tasma yok.
  const govde = await p.evaluate(() => ({
    scroll: document.documentElement.scrollHeight,
    ic: window.innerHeight,
  }));
  expect(govde.scroll).toBeLessThanOrEqual(govde.ic + 1);

  // 2. Kabuk gorunum penceresini asmaz.
  const kabuk = await p.locator(".kabuk").boundingBox();
  expect(kabuk!.height).toBeLessThanOrEqual(govde.ic + 1);

  // 3. Uye listesi TASMAZ, kendi icinde kayar.
  const kaydirilabilir = await p.evaluate(() => {
    const el = document.querySelector("aside");
    if (!el) return null;
    const s = getComputedStyle(el);
    return { overflowY: s.overflowY, tasma: el.scrollHeight > el.clientHeight };
  });
  expect(kaydirilabilir).not.toBeNull();
  expect(["auto", "scroll"]).toContain(kaydirilabilir!.overflowY);

  // 4. Sohbet ve kanal rayi hala ekranda: asil sikayet buydu.
  await expect(p.getByRole("log")).toBeVisible();
  await expect(p.locator("nav")).toBeVisible();

  await ctx.close();
});
