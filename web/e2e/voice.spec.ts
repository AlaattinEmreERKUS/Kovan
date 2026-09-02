import { test, expect } from "@playwright/test";
import { baglandi, davetUret, kayitOl } from "./yardim";

test("iki kullanici ses kanalinda gercekten baglanir ve ses akar", async ({ browser }) => {
  const damga = Date.now();
  await davetUret(`V1-${damga}`);
  await davetUret(`V2-${damga}`);

  const ctxA = await browser.newContext();
  const ctxB = await browser.newContext();
  const a = await ctxA.newPage();
  const b = await ctxB.newPage();

  await kayitOl(a, `V1-${damga}`, `Sesli${damga}`);
  await kayitOl(b, `V2-${damga}`, `Kulak${damga}`);

  await a.getByLabel("Ses kanalına katıl").click();
  await b.getByLabel("Ses kanalına katıl").click();

  // Her iki taraf da digerini uye listesinde gorur.
  await expect(a.getByText("2/4")).toBeVisible();
  await expect(b.getByText("2/4")).toBeVisible();

  // Sahte degil, gercek ICE: iki taraf da connected olmali.
  await baglandi(a);
  await baglandi(b);

  // Uzak mikrofon track'i canli.
  const uzakDurum = await b.evaluate(() => {
    const v = (window as unknown as { __kovan: { voice: { remote: Map<string, { mic: MediaStreamTrack | null }> } } }).__kovan.voice;
    const ilk = [...v.remote.values()][0];
    return ilk?.mic?.readyState ?? "yok";
  });
  expect(uzakDurum).toBe("live");

  // Once uygulamanin KENDI gostergesi: sesin aktiginin birinci kanitidir.
  // Asagidaki ham olcum ayni uzak track'ten ikinci bir AudioContext kaynagi
  // acar ve uygulamanin analizini ac birakir; bu yuzden once bu gelir.
  await expect(b.locator("li.konusuyor")).toBeVisible({ timeout: 10_000 });

  // Bagimsiz ikinci kanit: ham RMS sifirdan buyuk olmali.
  const rms = await b.evaluate(async () => {
    const v = (window as unknown as { __kovan: { voice: { remote: Map<string, { mic: MediaStreamTrack | null }> } } }).__kovan.voice;
    const track = [...v.remote.values()][0].mic!;
    const ctx = new AudioContext();
    const kaynak = ctx.createMediaStreamSource(new MediaStream([track]));
    const analiz = ctx.createAnalyser();
    kaynak.connect(analiz);
    const tampon = new Float32Array(analiz.fftSize);
    // Ilk karelerde tampon bos olabilir; birkac kez ornekle ve en yuksegini al.
    let enYuksek = 0;
    for (let i = 0; i < 30; i++) {
      await new Promise((r) => setTimeout(r, 100));
      analiz.getFloatTimeDomainData(tampon);
      const kare = Math.sqrt(tampon.reduce((t, x) => t + x * x, 0) / tampon.length);
      enYuksek = Math.max(enYuksek, kare);
    }
    return enYuksek;
  });
  expect(rms).toBeGreaterThan(0.001);

  // Mute karsi tarafta rozet olarak gorunur.
  await a.getByLabel("Mikrofonu kapat").click();
  // Rozet iki yuzeyde birden var (kanal listesi + sahne karesi); kanal
  // listesindekini kapsamla, yoksa strict mode iki eleman bulur.
  await expect(b.getByRole("navigation").getByLabel("mikrofonu kapalı")).toBeVisible();

  // Ayrilinca listeden duser.
  await a.getByLabel("Odadan ayrıl").click();
  await expect(b.getByText("1/4")).toBeVisible();

  await ctxA.close();
  await ctxB.close();
});

test("sahne mesaj alaninin yerini alir, metin sekmesi sesten atmaz", async ({ browser }) => {
  const damga = Date.now();
  await davetUret(`S1-${damga}`);

  const ctx = await browser.newContext();
  const a = await ctx.newPage();
  await kayitOl(a, `S1-${damga}`, `Sekme${damga}`);

  // Baslangic: metin sekmesi. Mesaj listesi gorunur, sahne yok.
  await expect(a.getByRole("log")).toBeVisible();
  await expect(a.locator('[data-kare="kisi"]')).toHaveCount(0);

  await a.getByLabel("Ses kanalına katıl").click();

  // Sahne acildi: mesaj listesi gitti, kendi karen geldi.
  await expect(a.locator('[data-kare="kisi"][data-kendisi="true"]')).toBeVisible();
  await expect(a.getByRole("log")).toHaveCount(0);
  await expect(a.getByLabel("Odadan ayrıl")).toBeVisible();

  // Metin sekmesine don: mesajlar geri geldi, ses DEVAM ediyor.
  await a.getByLabel("Metin kanalı: genel").click();
  await expect(a.getByRole("log")).toBeVisible();
  await expect(a.locator('[data-kare="kisi"]')).toHaveCount(0);

  // Sol alt panel gorunur ve mikrofon oradan kapanabilir.
  // Sol alt panelin donus dugmesi; kanal listesindekinden AYRI etiketi var.
  await expect(a.getByLabel("Ses bağlandı — sahneye dön")).toBeVisible();
  await a.getByLabel("Mikrofonu kapat").click();
  await expect(a.getByLabel("Mikrofonu aç")).toBeVisible();

  // Panelden sahneye don.
  await a.getByLabel("Ses bağlandı — sahneye dön").click();
  await expect(a.locator('[data-kare="kisi"][data-kendisi="true"]')).toBeVisible();

  // Cubuktaki ayril kanaldan cikarir ve metin sekmesine dondurur.
  await a.getByLabel("Odadan ayrıl").click();
  await expect(a.getByRole("log")).toBeVisible();
  await expect(a.locator('[data-kare="kisi"]')).toHaveCount(0);
  await expect(a.getByLabel("Ses kanalına katıl")).toBeVisible();

  await ctx.close();
});

test("gorunum modu videosuz kareleri gizler ve secim kalici olur", async ({ browser }) => {
  const damga = Date.now();
  await davetUret(`S2-${damga}`);

  const ctx = await browser.newContext();
  const a = await ctx.newPage();
  await kayitOl(a, `S2-${damga}`, `Gorunum${damga}`);

  await a.getByLabel("Ses kanalına katıl").click();
  await expect(a.locator('[data-kare="kisi"]')).toHaveCount(1);

  // Kamera kapali: "yalniz video" modunda hicbir kare kalmaz.
  await a.getByLabel("Yalnız video açık olanları göster").click();
  await expect(a.locator('[data-kare="kisi"]')).toHaveCount(0);
  await expect(a.getByText("Kimsenin kamerası açık değil")).toBeVisible();

  // Secim localStorage'a yazildi: sayfa yenilenince korunur.
  await a.reload();
  // Ses oturumu hello gelince kuruluyor. Mesaj listesi BOSKEN de gorunur,
  // yani onu beklemek yetmez: mesajlarin gelmesi hello'nun ulastiginin
  // kanitidir. Erken tiklamak sessizce hicbir sey yapmaz.
  await expect(a.locator("article").first()).toBeVisible({ timeout: 10_000 });
  await a.getByLabel("Ses kanalına katıl").click();
  await expect(a.getByText("Kimsenin kamerası açık değil")).toBeVisible();

  // Geri al.
  await a.getByLabel("Herkesi göster").click();
  await expect(a.locator('[data-kare="kisi"]')).toHaveCount(1);

  await ctx.close();
});
