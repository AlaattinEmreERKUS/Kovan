import { test, expect } from "@playwright/test";
import { davetUret, kayitOl } from "./yardim";

/**
 * Native seciciyi acamayiz (headless'ta zaten yok). getDisplayMedia'yi canvas +
 * osilator ureten bir sahteyle degistiriyoruz: video track hareketli, ses
 * track'i duyulur bir ton. Gercek yakalama spike'ta elle olculdu (spec 8.1).
 */
const SAHTE_EKRAN = () => {
  const nav = navigator as unknown as {
    mediaDevices: { getDisplayMedia: (o: unknown) => Promise<MediaStream> };
  };
  nav.mediaDevices.getDisplayMedia = async (o: unknown) => {
    const secenek = o as { audio?: boolean };
    const canvas = document.createElement("canvas");
    canvas.width = 640; canvas.height = 360;
    const ciz = canvas.getContext("2d")!;
    setInterval(() => {
      ciz.fillStyle = `hsl(${(Date.now() / 20) % 360} 70% 45%)`;
      ciz.fillRect(0, 0, 640, 360);
    }, 100);
    const stream = (canvas as HTMLCanvasElement & { captureStream(f: number): MediaStream })
      .captureStream(30);

    if (secenek.audio) {
      const ctx = new AudioContext();
      const osc = ctx.createOscillator();
      osc.frequency.value = 440;
      const hedef = ctx.createMediaStreamDestination();
      osc.connect(hedef);
      osc.start();
      for (const t of hedef.stream.getAudioTracks()) stream.addTrack(t);
    }
    return stream;
  };
};

test("ekran paylasimi izleyiciye ayri yuvalardan ulasir", async ({ browser }) => {
  const damga = Date.now();
  await davetUret(`S1-${damga}`);
  await davetUret(`S2-${damga}`);

  const ctxA = await browser.newContext();
  const ctxB = await browser.newContext();
  await ctxA.addInitScript(SAHTE_EKRAN);
  const a = await ctxA.newPage();
  const b = await ctxB.newPage();

  await kayitOl(a, `S1-${damga}`, `Paylasan${damga}`);
  await kayitOl(b, `S2-${damga}`, `Izleyen${damga}`);

  await a.getByLabel("Ses kanalına katıl").click();
  await b.getByLabel("Ses kanalına katıl").click();
  await expect(a.getByText("2/4")).toBeVisible();

  // Kendi on-diyalogumuz yok: dugme dogrudan native seciciyi acar (share.ts).
  // Yuzey ve sistem sesi secimi orada yapilir; sahte getDisplayMedia
  // constraint'teki audio:true'yu "kullanici kutuyu isaretledi" gibi okur.
  await a.getByLabel("Ekran paylaş").click();

  // Paylasan tarafta Kovan seridi gorunur (Chromium cubugunun kopyasi degil).
  await expect(a.getByRole("status")).toContainText("Ekranını paylaşıyorsun");
  await expect(a.getByRole("status")).toContainText("sistem sesi açık");

  // Izleyicide kare ve rozet.
  await expect(b.getByLabel("ekran paylaşıyor")).toBeVisible({ timeout: 15_000 });
  await expect(b.locator('[data-kare="ekran"] video')).toBeVisible({ timeout: 15_000 });

  // Ekran ANA ALANDA, kisi kareleri altta seritte: dikkatin merkezi
  // paylasilan ekrandir, kameralar kucuk kalir (Discord duzeni).
  for (const s of [a, b]) {
    await expect(s.locator('[data-alan="ana"] [data-kare="ekran"]')).toHaveCount(1);
    await expect(s.locator('[data-alan="ana"] [data-kare="kisi"]')).toHaveCount(0);
    await expect(s.locator('[data-alan="serit"] [data-kare="kisi"]')).toHaveCount(2);
  }

  // Paylasan taraf kendi ekranini da gorur (sonsuz ayna bilerek serbest),
  // ama kendi ekran sesini kisacak kaydirici cizilmez.
  await expect(a.locator('[data-kare="ekran"]')).toHaveCount(1);
  await expect(a.getByLabel(/ekran ses seviyesi/)).toHaveCount(0);

  // Track'ler DOGRU YUVALARDA. Dort yuva da dolu: ontrack her m-line icin
  // atesleniyor ve track'ler artik geldikleri anda saklaniyor (rtc/session.ts).
  // Onemli olan ESLEMENIN dogrulugu -- ekran videosu cam yuvasina, ekran sesi
  // mikrofon yuvasina dusmemeli.
  await expect.poll(async () => b.evaluate(() => {
    const v = (window as unknown as { __kovan: { voice: { remote: Map<string, {
      mic: MediaStreamTrack | null; cam: MediaStreamTrack | null;
      screenVideo: MediaStreamTrack | null; screenAudio: MediaStreamTrack | null;
    }> } } }).__kovan.voice;
    const t = [...v.remote.values()][0];
    if (!t) return "yok";
    return [
      t.mic ? "mic" : "-",
      t.cam ? "cam" : "-",
      t.screenVideo ? "sv" : "-",
      t.screenAudio ? "sa" : "-",
    ].join(",");
  }), { timeout: 20_000 }).toBe("mic,cam,sv,sa");

  // Dolu cam yuvasi kare CIZDIRMEZ: karsi tarafin kamerasi kapali oldugu
  // surece (VoiceMember.camera=false) kisi karesinde video elementi olmaz.
  // Plan 2'de "herkese bos siyah kare" hatasini uretmisti; koruma artik
  // gorunurluk katmaninda (lib/stage.ts).
  await expect(b.locator('[data-kare="kisi"] video')).toHaveCount(0);

  // Form denetimleri TEMA renginde: tarayici varsayilani mavi, bal degil.
  // accent-color body'den kalitiliyor (tokens.css).
  await expect(b.getByLabel(/ekran ses seviyesi/)).toHaveCSS("accent-color", "rgb(232, 163, 61)");

  // Kaydiriciyi 0'a cekmek ekran sesini susturur; mikrofon etkilenmez.
  await b.getByLabel(/ekran ses seviyesi/).fill("0");
  const seviye = await b.evaluate(() => {
    const k = (window as unknown as {
      __kovan: {
        oturum: { mixer: { volumeOf(id: string): number } };
        voice: { remote: Map<string, unknown> };
      };
    }).__kovan;
    const id = [...k.voice.remote.keys()][0];
    return k.oturum.mixer.volumeOf(id);
  });
  expect(seviye).toBe(0);

  // Paylasimi durdurunca izleyicide kare ve rozet kaybolur.
  // Seridin kendi durdurma dugmesi. exact sart: kontrol cubugundaki
  // "Ekran paylasimini durdur" da "Durdur" ile eslesiyor.
  await a.getByRole("status").getByRole("button", { name: "Durdur", exact: true }).click();
  await expect(b.getByLabel("ekran paylaşıyor")).toBeHidden({ timeout: 15_000 });

  await ctxA.close();
  await ctxB.close();
});

test("paylasim bitince ekran karesi kalkar, kisi kareleri kalir", async ({ browser }) => {
  const damga = Date.now();
  await davetUret(`S3-${damga}`);
  await davetUret(`S4-${damga}`);

  const ctxA = await browser.newContext();
  const ctxB = await browser.newContext();
  await ctxA.addInitScript(SAHTE_EKRAN);
  const a = await ctxA.newPage();
  const b = await ctxB.newPage();

  await kayitOl(a, `S3-${damga}`, `Biten${damga}`);
  await kayitOl(b, `S4-${damga}`, `Bakan${damga}`);

  await a.getByLabel("Ses kanalına katıl").click();
  await b.getByLabel("Ses kanalına katıl").click();
  await expect(a.getByText("2/4")).toBeVisible();

  // Paylasim oncesi: yalniz iki kisi karesi.
  await expect(b.locator('[data-kare="kisi"]')).toHaveCount(2);
  await expect(b.locator('[data-kare="ekran"]')).toHaveCount(0);

  // Secim native secicide yapilir; on-diyalog yok (share.ts).
  await a.getByLabel("Ekran paylaş").click();

  await expect(b.locator('[data-kare="ekran"]')).toHaveCount(1, { timeout: 15_000 });
  await expect(b.locator('[data-kare="kisi"]')).toHaveCount(2);

  // Serit sahnedeyken de gorunur; durdurma dugmesi oradan calisir.
  await a.getByRole("status").getByRole("button", { name: "Durdur", exact: true }).click();

  await expect(b.locator('[data-kare="ekran"]')).toHaveCount(0, { timeout: 15_000 });
  await expect(b.locator('[data-kare="kisi"]')).toHaveCount(2);

  await ctxA.close();
  await ctxB.close();
});

test("ekran buyutulup kucultulur, Esc de kapatir", async ({ browser }) => {
  const damga = Date.now();
  await davetUret(`S5-${damga}`);
  await davetUret(`S6-${damga}`);

  const ctxA = await browser.newContext();
  const ctxB = await browser.newContext();
  await ctxA.addInitScript(SAHTE_EKRAN);
  const a = await ctxA.newPage();
  const b = await ctxB.newPage();

  await kayitOl(a, `S5-${damga}`, `Buyuten${damga}`);
  await kayitOl(b, `S6-${damga}`, `Goren${damga}`);

  await a.getByLabel("Ses kanalına katıl").click();
  await b.getByLabel("Ses kanalına katıl").click();
  await expect(a.getByText("2/4")).toBeVisible();

  await a.getByLabel("Ekran paylaş").click();
  await expect(b.locator('[data-kare="ekran"]')).toHaveCount(1, { timeout: 15_000 });
  await expect(b.locator('[data-alan="serit"] [data-kare="kisi"]')).toHaveCount(2);

  // Buyutme IZLEYICININ kendi karari: paylasan tarafi etkilemez.
  await b.getByLabel("Ekranı büyüt").click();
  await expect(b.locator('[data-kare="ekran"][data-buyuk="true"]')).toHaveCount(1);
  // Buyukken serit kalkar, kontrol cubugu durur.
  await expect(b.locator('[data-alan="serit"]')).toHaveCount(0);
  await expect(b.getByLabel("Odadan ayrıl")).toBeVisible();
  await expect(a.locator('[data-kare="ekran"][data-buyuk="true"]')).toHaveCount(0);

  // Dugmeyle kucult.
  await b.getByLabel("Ekranı küçült").click();
  await expect(b.locator('[data-kare="ekran"][data-buyuk="true"]')).toHaveCount(0);
  await expect(b.locator('[data-alan="serit"] [data-kare="kisi"]')).toHaveCount(2);

  // Esc de kucultur.
  await b.getByLabel("Ekranı büyüt").click();
  await expect(b.locator('[data-kare="ekran"][data-buyuk="true"]')).toHaveCount(1);
  await b.keyboard.press("Escape");
  await expect(b.locator('[data-kare="ekran"][data-buyuk="true"]')).toHaveCount(0);

  // Paylasim biterse buyutme asili kalmaz.
  await b.getByLabel("Ekranı büyüt").click();
  await a.getByRole("status").getByRole("button", { name: "Durdur", exact: true }).click();
  await expect(b.locator('[data-kare="ekran"]')).toHaveCount(0, { timeout: 15_000 });
  await expect(b.locator('[data-kare="kisi"]')).toHaveCount(2);

  await ctxA.close();
  await ctxB.close();
});

test("kaynak degistirilince izleyici kopma gormez", async ({ browser }) => {
  const damga = Date.now();
  await davetUret(`S7-${damga}`);
  await davetUret(`S8-${damga}`);

  const ctxA = await browser.newContext();
  const ctxB = await browser.newContext();
  await ctxA.addInitScript(SAHTE_EKRAN);
  const a = await ctxA.newPage();
  const b = await ctxB.newPage();

  await kayitOl(a, `S7-${damga}`, `Degistiren${damga}`);
  await kayitOl(b, `S8-${damga}`, `Izleyen${damga}`);

  await a.getByLabel("Ses kanalına katıl").click();
  await b.getByLabel("Ses kanalına katıl").click();
  await expect(a.getByText("2/4")).toBeVisible();

  await a.getByLabel("Ekran paylaş").click();
  await expect(b.locator('[data-kare="ekran"] video')).toBeVisible({ timeout: 15_000 });

  const yerelIz = () => a.evaluate(() => {
    const k = window as unknown as { __kovan: { voice: { local: { screenVideo: MediaStreamTrack | null } } } };
    return k.__kovan.voice.local.screenVideo?.id ?? null;
  });
  const uzakIz = () => b.evaluate(() => {
    const k = window as unknown as {
      __kovan: { voice: { remote: Map<string, { screenVideo: MediaStreamTrack | null }> } };
    };
    return [...k.__kovan.voice.remote.values()][0]?.screenVideo?.id ?? null;
  });

  const yerelOnce = await yerelIz();
  const uzakOnce = await uzakIz();
  expect(yerelOnce).not.toBeNull();
  expect(uzakOnce).not.toBeNull();

  // Serit dugmesi. exact sart: kontrol cubugunda baska metinler de var.
  await a.getByRole("status").getByRole("button", { name: "Değiştir", exact: true }).click();

  // Paylasanin YEREL kaynagi degisir.
  await expect.poll(yerelIz, { timeout: 20_000 }).not.toBe(yerelOnce);

  // Izleyicinin UZAK track'i AYNI kalir: replaceTrack yeniden gorusme
  // baslatmaz, ayni RTP akisinin kaynagi degisir. Kopma yoklugunun kaniti
  // budur -- yeni bir track gelseydi bir an bos kare olurdu.
  expect(await uzakIz()).toBe(uzakOnce);
  await expect(b.getByLabel("ekran paylaşıyor")).toBeVisible();
  await expect(b.locator('[data-kare="ekran"]')).toHaveCount(1);

  // Paylasan tarafta serit hic dusmedi.
  await expect(a.getByRole("status")).toContainText("Ekranını paylaşıyorsun");

  // Degistirmeden sonra durdurmak hala calisir (eski track'in ended'i
  // yeni paylasimi kapatmis olsaydi bu kapi zaten once patlardi).
  await a.getByRole("status").getByRole("button", { name: "Durdur", exact: true }).click();
  await expect(b.getByLabel("ekran paylaşıyor")).toBeHidden({ timeout: 15_000 });

  await ctxA.close();
  await ctxB.close();
});
