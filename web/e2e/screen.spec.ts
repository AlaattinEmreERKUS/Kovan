import { test, expect, type Page } from "@playwright/test";

const API = "http://127.0.0.1:8787";

async function davetUret(kod: string) {
  const res = await fetch(`${API}/api/dev/invite`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ code: kod }),
  });
  expect(res.ok).toBeTruthy();
}

async function kayitOl(page: Page, kod: string, kullanici: string) {
  await page.goto("/giris");
  await page.getByRole("button", { name: /Kayıt ol$/ }).click();
  await page.getByPlaceholder("Davet kodu").fill(kod);
  await page.getByPlaceholder("Görünen ad").fill(kullanici);
  await page.getByPlaceholder("Kullanıcı adı").fill(kullanici.toLowerCase());
  await page.getByPlaceholder("Parola").fill("kovan123");
  await page.getByRole("button", { name: "Kayıt ol" }).click();
  await expect(page.getByRole("log")).toBeVisible();
}

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

  // On-diyalog bizim arayuzumuz, native secici degil.
  await a.getByLabel("Ekran paylaş").click();
  await expect(a.getByRole("dialog", { name: "Ekran paylaşımı ayarları" })).toBeVisible();
  await a.getByLabel("Tüm ekran").check();
  await a.getByLabel("Sistem sesini de paylaş").check();
  await a.getByRole("button", { name: "Devam" }).click();

  // Paylasan tarafta Kovan seridi gorunur (Chromium cubugunun kopyasi degil).
  await expect(a.getByRole("status")).toContainText("Ekranını paylaşıyorsun");
  await expect(a.getByRole("status")).toContainText("sistem sesi açık");

  // Izleyicide kare ve rozet.
  await expect(b.getByLabel("ekran paylaşıyor")).toBeVisible({ timeout: 15_000 });
  await expect(b.locator("figure.ekran video")).toBeVisible({ timeout: 15_000 });

  // Track'ler DOGRU YUVALARDA: screenVideo ve screenAudio dolu, mikrofon ayri.
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
  }), { timeout: 20_000 }).toBe("mic,-,sv,sa");

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
