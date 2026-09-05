<script lang="ts">
  import { voice } from "$lib/voice.svelte";
  import { ESIK_MAKS, type SesAyarlari } from "$lib/ses-ayarlari";
  import type { GirisModu } from "$lib/rtc/kapi";
  import { isTauri, kopru, KISAYOL_ADLARI, type KisayolAdi } from "$lib/masaustu";
  import {
    KISAYOL_ETIKETI,
    kisayollariOku,
    kisayollariYaz,
    type KayitSonucu,
  } from "$lib/kisayollar";
  import Icon from "./Icon.svelte";
  import {
    cihazlariListele, cikisDesteginVar, izinAl, tarayiciCihazDeps, type Cihaz,
  } from "$lib/rtc/cihazlar";

  let {
    kisayolSonuclari, onKapat, onDegis,
    onGirisCihazi, onCikisCihazi, onBip, onGeriDinlemeBasla, onGeriDinlemeBitir,
  }: {
    kisayolSonuclari: KayitSonucu[];
    onKapat: () => void;
    onDegis: (a: SesAyarlari) => void;
    onGirisCihazi: (id: string | null) => void;
    onCikisCihazi: (id: string | null) => void;
    onBip: () => void;
    onGeriDinlemeBasla: () => void;
    onGeriDinlemeBitir: () => void;
  } = $props();

  let girisler = $state<Cihaz[]>([]);
  let cikislar = $state<Cihaz[]>([]);
  const cikisDestekli = cikisDesteginVar();

  /**
   * Secim TERCIHTEN okunur, etkin cihazdan degil: cihaz kaybolunca varsayilana
   * duseriz ama kullanicinin secimi durur ve menu onu gostermeye devam etmeli.
   * Store'dan okundugu icin tepkiseldir; metot cagrisiyken cihaz geri
   * takilinca menu repaint olmuyordu.
   */
  const girisSecili = $derived(voice.girisTercihi);
  const cikisSecili = $derived(voice.cikisTercihi);

  /** Gorulmus etiketler. Cihaz cikinca adini listeden okuyamayiz. */
  let etiketler = $state<Record<string, string>>({});

  /**
   * enumerateDevices izin verilene kadar BOS etiket doner; once izin alinir,
   * yoksa kullanici "Adsiz cihaz" listesi gorurdu.
   */
  async function cihazlariTazele() {
    const deps = tarayiciCihazDeps();
    await izinAl(deps);
    const bulunan = await cihazlariListele(deps);
    girisler = bulunan.girisler;
    cikislar = bulunan.cikislar;
    const yeni = { ...etiketler };
    for (const c of [...bulunan.girisler, ...bulunan.cikislar]) yeni[c.id] = c.etiket;
    etiketler = yeni;
  }

  /**
   * Tercih edilen cihaz su an BAGLI DEGILSE listede yoktur; `<select>` degeri
   * hicbir secenekle eslesmeyince tarayici ilk secenegi gosterir ve kullanici
   * secimini kaybetmis SANIR. Hayalet secenek secimi gorunur tutar.
   */
  function hayalet(secili: string | null, liste: Cihaz[]): Cihaz | null {
    if (!secili || liste.some((c) => c.id === secili)) return null;
    return { id: secili, etiket: `${etiketler[secili] ?? "Seçili cihaz"} (bağlı değil)` };
  }
  const girisHayalet = $derived(hayalet(girisSecili, girisler));
  const cikisHayalet = $derived(hayalet(cikisSecili, cikislar));

  $effect(() => {
    void cihazlariTazele();
    const md = navigator.mediaDevices;
    const f = () => void cihazlariTazele();
    md?.addEventListener("devicechange", f);
    return () => {
      md?.removeEventListener("devicechange", f);
      onGeriDinlemeBitir();   // panel kapanirken geri dinleme acik kalmasin
    };
  });

  /** `<select>` degeri metindir; bos secenek "varsayilan" demektir. */
  const deger = (v: string) => (v === "" ? null : v);

  let kisayollar = $state(kisayollariOku());
  /**
   * Kullanici tusu degistirdikten sonraki kayit sonucu. Prop tek yonlu:
   * sayfa yalnizca ACILIS kaydinin sonucunu verir, burada yapilan yeni
   * kayidi geri yazamaz. null = henuz degistirilmedi, prop gecerli.
   */
  let yerelSonuclar = $state<KayitSonucu[] | null>(null);
  const sonuclar = $derived(yerelSonuclar ?? kisayolSonuclari);

  function kisayolDegis(ad: KisayolAdi, tus: string) {
    kisayollar = { ...kisayollar, [ad]: tus };
    kisayollariYaz(kisayollar);
    const k = kopru();
    if (!k) return;
    void k
      .invoke<KayitSonucu[]>("kisayollari_ayarla", { kisayollar })
      .then((s) => { yerelSonuclar = s; })
      .catch(() => { yerelSonuclar = []; });
  }

  const a = $derived(voice.sesAyarlari);
  /** Cubuk ve esik ayni olcekte cizilir; kullanici ikisini karsilastirir. */
  const yuzde = $derived(Math.min(100, (voice.girisSeviyesi / ESIK_MAKS) * 100));
  const esikYuzde = $derived((a.esik / ESIK_MAKS) * 100);
  const geciyor = $derived(voice.girisSeviyesi >= a.esik);

  function degis(yama: Partial<SesAyarlari>) {
    onDegis({ ...a, ...yama });
  }
</script>

<div class="panel" role="dialog" aria-label="Ses ayarları">
  <div class="baslik">
    <span>Ses ayarları</span>
    <button class="kapat" aria-label="Ses ayarlarını kapat" onclick={onKapat}>×</button>
  </div>

  <label class="alan" for="giris-cihazi">
    Mikrofon
    {#if voice.mikYok}<span class="uyari">yok</span>{/if}
  </label>
  <select
    id="giris-cihazi"
    value={girisSecili ?? ""}
    onchange={(e) => onGirisCihazi(deger(e.currentTarget.value))}
  >
    <option value="">Varsayılan</option>
    {#each girisler as c (c.id)}
      <option value={c.id}>{c.etiket}</option>
    {/each}
    {#if girisHayalet}
      <option value={girisHayalet.id}>{girisHayalet.etiket}</option>
    {/if}
  </select>

  <label class="alan" for="cikis-cihazi">Kulaklık / hoparlör</label>
  <select
    id="cikis-cihazi"
    value={cikisSecili ?? ""}
    disabled={!cikisDestekli}
    onchange={(e) => onCikisCihazi(deger(e.currentTarget.value))}
  >
    <option value="">Varsayılan</option>
    {#each cikislar as c (c.id)}
      <option value={c.id}>{c.etiket}</option>
    {/each}
    {#if cikisHayalet}
      <option value={cikisHayalet.id}>{cikisHayalet.etiket}</option>
    {/if}
  </select>
  {#if !cikisDestekli}
    <p class="uyari" role="status">
      Tarayıcın çıkış cihazı seçimini desteklemiyor; sistem varsayılanı kullanılıyor.
    </p>
  {/if}

  <div class="testler">
    <button type="button" class="test" onclick={onBip}>Sesi test et</button>
    <button
      type="button"
      class="test"
      disabled={voice.mikYok}
      onpointerdown={onGeriDinlemeBasla}
      onpointerup={onGeriDinlemeBitir}
      onpointerleave={onGeriDinlemeBitir}
    >Kendini dinle</button>
  </div>

  <div class="ayirac"></div>

  <label class="alan" for="esik">
    Giriş hassasiyeti
    <span class="ipucu">{a.esik === 0 ? "kapalı" : "eşiğin altındaki ses gitmez"}</span>
  </label>

  <!-- Canli cubuk: konusurken bal rengine doner, yani kapi aciliyor. -->
  <div class="olcer" aria-hidden="true">
    <div class="dolgu" class:gecer={geciyor} style="width: {yuzde}%"></div>
    <div class="esikCizgi" style="left: {esikYuzde}%"></div>
  </div>

  <input
    id="esik"
    type="range" min="0" max={ESIK_MAKS} step="0.001"
    value={a.esik}
    aria-label="Giriş hassasiyeti eşiği"
    oninput={(e) => degis({ esik: Number(e.currentTarget.value) })}
  />

  <label class="satir">
    <input
      type="checkbox" checked={a.gurultuBastirma}
      onchange={(e) => degis({ gurultuBastirma: e.currentTarget.checked })}
    />
    Gürültü bastırma
  </label>
  <label class="satir">
    <input
      type="checkbox" checked={a.yankiEngelleme}
      onchange={(e) => degis({ yankiEngelleme: e.currentTarget.checked })}
    />
    Yankı engelleme
  </label>
  <label class="satir">
    <input
      type="checkbox" checked={a.otomatikSeviye}
      onchange={(e) => degis({ otomatikSeviye: e.currentTarget.checked })}
    />
    Otomatik seviye
  </label>

  {#if isTauri()}
    <div class="ayirac"></div>

    <label class="alan" for="mod">Giriş modu</label>
    <select
      id="mod"
      value={a.girisModu}
      onchange={(e) => degis({ girisModu: e.currentTarget.value as GirisModu })}
    >
      <option value="ses-etkinligi">Ses etkinliği</option>
      <option value="bas-konus">Bas-konuş</option>
    </select>

    {#each KISAYOL_ADLARI as ad (ad)}
      {@const sonuc = sonuclar.find((s) => s.ad === ad)}
      <label class="satir kisayol">
        <span>{KISAYOL_ETIKETI[ad]}</span>
        <input
          type="text"
          value={kisayollar[ad]}
          aria-label={`${KISAYOL_ETIKETI[ad]} kısayolu`}
          onchange={(e) => kisayolDegis(ad, e.currentTarget.value)}
        />
      </label>
      {#if sonuc && !sonuc.kayitli}
        <p class="uyari" role="status">
          Bu kısayol başka bir uygulamada kayıtlı, çalışmayacak.
        </p>
      {/if}
    {/each}
  {/if}

  <p class="not"><Icon ad="mik" boyut={12} /> Ayarlar yalnız sende kalır, karşı tarafa gitmez.</p>
</div>

<style>
  .panel {
    position: absolute; right: 0; bottom: calc(100% + 8px); z-index: 20;
    width: 280px; display: flex; flex-direction: column; gap: 8px;
    padding: 12px; border-radius: var(--radius);
    background: var(--zemin-2); border: 1px solid var(--cizgi);
    box-shadow: 0 12px 32px rgba(0, 0, 0, 0.45);
    font-size: 12px; color: var(--metin-1); text-align: left;
  }
  .baslik { display: flex; align-items: center; justify-content: space-between; font-weight: 600; }
  .kapat {
    border: none; background: none; color: var(--metin-3);
    font-size: 18px; line-height: 1; cursor: pointer; padding: 0 2px;
  }
  .kapat:hover { color: var(--metin-1); }
  .alan { display: flex; justify-content: space-between; gap: 8px; color: var(--metin-2); }
  .ipucu { color: var(--metin-3); font-size: 11px; }

  .olcer {
    position: relative; height: 8px; border-radius: 4px;
    background: var(--zemin-0); overflow: hidden;
  }
  .dolgu { height: 100%; background: var(--metin-3); transition: width 60ms linear; }
  .dolgu.gecer { background: var(--bal); }
  .esikCizgi {
    position: absolute; top: 0; bottom: 0; width: 2px;
    background: var(--tehlike); transform: translateX(-1px);
  }

  .satir { display: flex; align-items: center; gap: 8px; color: var(--metin-2); }
  .ayirac { height: 1px; background: var(--cizgi); margin: 2px 0; }
  select {
    background: var(--zemin-0); color: var(--metin-1);
    border: 1px solid var(--cizgi); border-radius: 4px; padding: 4px 6px;
    font-size: 12px;
  }
  select { width: 100%; text-overflow: ellipsis; }
  .testler { display: flex; gap: 6px; }
  .test {
    flex: 1; padding: 5px 6px; font-size: 11px; cursor: pointer;
    background: var(--zemin-0); color: var(--metin-1);
    border: 1px solid var(--cizgi); border-radius: 4px;
  }
  .test:hover:not(:disabled) { border-color: var(--bal); }
  .test:disabled { opacity: 0.45; cursor: default; }
  .kisayol { justify-content: space-between; }
  .kisayol input {
    width: 84px; text-align: center;
    background: var(--zemin-0); color: var(--metin-1);
    border: 1px solid var(--cizgi); border-radius: 4px; padding: 3px 4px;
    font-size: 12px;
  }
  .uyari { margin: 0; color: var(--tehlike); font-size: 11px; }
  .not {
    display: flex; align-items: center; gap: 5px; margin: 2px 0 0;
    color: var(--metin-3); font-size: 11px;
  }
</style>
