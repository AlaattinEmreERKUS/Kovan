import { test, expect } from "@playwright/test";
import { davetUret, kayitOl } from "./yardim";

test("iki kullanici gercek zamanli mesajlasir ve tepki verir", async ({ browser }) => {
  const damga = Date.now();
  await davetUret(`E1-${damga}`);
  await davetUret(`E2-${damga}`);

  const ctxA = await browser.newContext();
  const ctxB = await browser.newContext();
  const a = await ctxA.newPage();
  const b = await ctxB.newPage();

  await kayitOl(a, `E1-${damga}`, `Napol${damga}`);
  await kayitOl(b, `E2-${damga}`, `Denis${damga}`);

  // A yazar, B anlik gorur
  const mesaj = `selam kovan ${damga}`;
  await a.getByLabel("Mesaj yaz").fill(mesaj);
  await a.getByLabel("Mesaj yaz").press("Enter");
  await expect(b.getByText(mesaj)).toBeVisible();

  // B tepki verir, A gorur
  // Tepki dugmesi MESAJA bagli secilmeli: .first() sayfadaki en eski mesajin
  // dugmesini tikliyor ve yerel wrangler dev veritabani kosular arasi kaliyor.
  const satir = b.locator(".mesaj", { hasText: mesaj });
  await satir.hover();
  await satir.getByLabel("🔥 ekle").click();
  // Dogrulama da MESAJA baglanmali: yerel wrangler dev veritabani kosular
  // arasi kaliyor ve sayfadaki eski mesajlarin rozetleri de eslesiyor
  // (strict mode violation).
  const satirA = a.locator(".mesaj", { hasText: mesaj });
  await expect(satirA.getByLabel(/🔥 tepkisi, 1 kişi/)).toBeVisible();

  // A yaziyor gostergesi B'de gorunur
  await a.getByLabel("Mesaj yaz").fill("yaz");
  await expect(b.getByText(/yazıyor…/)).toBeVisible();

  await ctxA.close();
  await ctxB.close();
});
