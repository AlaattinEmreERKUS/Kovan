<script lang="ts">
  import { voice } from "$lib/voice.svelte";
  import type { GorunumModu } from "$lib/gorunum";
  import Icon from "./Icon.svelte";
  import SesAyarlariPanel from "./SesAyarlari.svelte";
  import type { SesAyarlari } from "$lib/ses-ayarlari";
  import type { KayitSonucu } from "$lib/kisayollar";

  let ayarlarAcik = $state(false);

  let {
    mod, kisayolSonuclari,
    onToggleMute, onToggleDeafen, onToggleCamera, onToggleScreen, onToggleGorunum,
    onSesAyari, onGirisCihazi, onCikisCihazi, onBip,
    onGeriDinlemeBasla, onGeriDinlemeBitir, onLeave,
  }: {
    mod: GorunumModu;
    kisayolSonuclari: KayitSonucu[];
    onToggleMute: () => void;
    onToggleDeafen: () => void;
    onToggleCamera: () => void;
    onToggleScreen: () => void;
    onToggleGorunum: () => void;
    onSesAyari: (a: SesAyarlari) => void;
    onGirisCihazi: (id: string | null) => void;
    onCikisCihazi: (id: string | null) => void;
    onBip: () => void;
    onGeriDinlemeBasla: () => void;
    onGeriDinlemeBitir: () => void;
    onLeave: () => void;
  } = $props();
</script>

<div class="cubuk">
  <div class="medya">
    <button
      class="dugme"
      class:kapali={voice.muted}
      aria-label={voice.muted ? "Mikrofonu aç" : "Mikrofonu kapat"}
      onclick={onToggleMute}
    ><Icon ad={voice.muted ? "mik-kapali" : "mik"} /></button>

    <button
      class="dugme"
      class:kapali={voice.deafened}
      aria-label={voice.deafened ? "Kulaklığı aç" : "Kulaklığı kapat"}
      onclick={onToggleDeafen}
    ><Icon ad={voice.deafened ? "kulaklik-kapali" : "kulaklik"} /></button>

    <button
      class="dugme"
      class:acik={voice.camera}
      aria-label={voice.camera ? "Kamerayı kapat" : "Kamerayı aç"}
      onclick={onToggleCamera}
    ><Icon ad={voice.camera ? "kamera" : "kamera-kapali"} /></button>

    <button
      class="dugme"
      class:acik={voice.screen}
      aria-label={voice.screen ? "Ekran paylaşımını durdur" : "Ekran paylaş"}
      onclick={onToggleScreen}
    ><Icon ad="ekran" /></button>
  </div>

  <div class="sag">
    <div class="ayarSarmal">
      <button
        class="dugme"
        class:acik={ayarlarAcik}
        aria-label={ayarlarAcik ? "Ses ayarlarını kapat" : "Ses ayarları"}
        onclick={() => (ayarlarAcik = !ayarlarAcik)}
      ><Icon ad="ayar" /></button>
      {#if ayarlarAcik}
        <SesAyarlariPanel
          {kisayolSonuclari}
          {onGirisCihazi} {onCikisCihazi} {onBip}
          {onGeriDinlemeBasla} {onGeriDinlemeBitir}
          onKapat={() => (ayarlarAcik = false)}
          onDegis={onSesAyari}
        />
      {/if}
    </div>

    <button
      class="dugme"
      class:acik={mod === "video"}
      aria-label={mod === "video" ? "Herkesi göster" : "Yalnız video açık olanları göster"}
      onclick={onToggleGorunum}
    ><Icon ad="gorunum" /></button>

    <span class="ayirac"></span>

    <button class="dugme ayril" aria-label="Odadan ayrıl" onclick={onLeave}>
      <Icon ad="ayril" />
    </button>
  </div>
</div>

<style>
  /* Panel cubugun USTUNDE acilir; sarmal konumlandirmayi tasir. */
  .ayarSarmal { position: relative; display: flex; }

  .cubuk {
    display: flex; align-items: center; gap: 6px;
    padding: 8px 12px; border-top: 1px solid var(--cizgi);
    background: var(--zemin-1);
  }
  /* Medya dortlusu ortada, gorunum + ayril sagda: en pahali yanlis tiklama
     "ayril", medya grubundan uzakta ve kirmizi durmali. */
  .medya { display: flex; gap: 4px; margin: 0 auto; }
  .sag { display: flex; align-items: center; gap: 4px; }

  .dugme {
    width: 36px; height: 32px; display: grid; place-items: center;
    color: var(--metin-2);
    transition: background var(--gecis), color var(--gecis);
  }
  .dugme:hover { background: var(--zemin-2); color: var(--metin-1); }
  .dugme.acik { color: var(--bal-sicak); background: var(--bal-zemin); }
  .dugme.kapali { color: var(--tehlike); }
  .dugme.ayril { color: var(--tehlike); }
  .dugme.ayril:hover { background: rgba(217, 88, 74, 0.14); color: var(--tehlike); }

  .ayirac { width: 1px; height: 20px; background: var(--cizgi); margin: 0 4px; }
</style>
