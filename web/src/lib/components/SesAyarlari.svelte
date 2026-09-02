<script lang="ts">
  import { voice } from "$lib/voice.svelte";
  import { ESIK_MAKS, type SesAyarlari } from "$lib/ses-ayarlari";
  import Icon from "./Icon.svelte";

  let { onKapat, onDegis }: {
    onKapat: () => void;
    onDegis: (a: SesAyarlari) => void;
  } = $props();

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

  <p class="not"><Icon ad="mik" boyut={12} /> Ayarlar yalnız sende kalır, karşı tarafa gitmez.</p>
</div>

<style>
  .panel {
    position: absolute; right: 0; bottom: calc(100% + 8px); z-index: 20;
    width: 260px; display: flex; flex-direction: column; gap: 8px;
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
  .not {
    display: flex; align-items: center; gap: 5px; margin: 2px 0 0;
    color: var(--metin-3); font-size: 11px;
  }
</style>
