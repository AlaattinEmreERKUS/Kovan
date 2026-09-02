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

/** Sayfadaki tum RTCPeerConnection'lar connected olana kadar bekler. */
async function baglandi(page: Page) {
  await expect.poll(async () => page.evaluate(() => {
    const k = (window as unknown as { __kovan?: { oturum: unknown } }).__kovan;
    if (!k) return "kanca-yok";
    const mesh = (k.oturum as { mesh?: { peers: Map<string, { o: { pc: RTCPeerConnection } }> } }).mesh;
    if (!mesh || mesh.peers.size === 0) return "peer-yok";
    return [...mesh.peers.values()].map((p) => p.o.pc.connectionState).join(",");
  }), { timeout: 25_000 }).toBe("connected");
}

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
  await expect(b.getByLabel("mikrofonu kapalı")).toBeVisible();

  // Ayrilinca listeden duser.
  await a.getByLabel("Ses kanalından ayrıl").click();
  await expect(b.getByText("1/4")).toBeVisible();

  await ctxA.close();
  await ctxB.close();
});
