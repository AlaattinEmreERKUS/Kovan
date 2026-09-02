<script lang="ts">
  import { voice } from "$lib/voice.svelte";
  import Icon from "./Icon.svelte";

  let { onToggleMute, onToggleDeafen, onToggleCamera, onToggleScreen, onLeave, onSahneyeDon }: {
    onToggleMute: () => void;
    onToggleDeafen: () => void;
    onToggleCamera: () => void;
    onToggleScreen: () => void;
    onLeave: () => void;
    onSahneyeDon: () => void;
  } = $props();
</script>

<div class="panel">
  <div class="ust">
    <button class="donus" aria-label="Ses sahnesine dön" onclick={onSahneyeDon}>
      <span class="nokta" aria-hidden="true"></span>
      <span class="metin">
        <span class="durum">Ses bağlandı</span>
        <span class="kanal">sohbet</span>
      </span>
    </button>
    <button class="dugme ayril" aria-label="Odadan ayrıl" onclick={onLeave}>
      <Icon ad="ayril" boyut={17} />
    </button>
  </div>

  <!-- Sira cubuktakiyle AYNI: iki yuzeyde tek kas hafizasi. -->
  <div class="alt">
    <button
      class="dugme"
      class:kapali={voice.muted}
      aria-label={voice.muted ? "Mikrofonu aç" : "Mikrofonu kapat"}
      onclick={onToggleMute}
    ><Icon ad={voice.muted ? "mik-kapali" : "mik"} boyut={18} /></button>

    <button
      class="dugme"
      class:kapali={voice.deafened}
      aria-label={voice.deafened ? "Kulaklığı aç" : "Kulaklığı kapat"}
      onclick={onToggleDeafen}
    ><Icon ad={voice.deafened ? "kulaklik-kapali" : "kulaklik"} boyut={18} /></button>

    <button
      class="dugme"
      class:acik={voice.camera}
      aria-label={voice.camera ? "Kamerayı kapat" : "Kamerayı aç"}
      onclick={onToggleCamera}
    ><Icon ad={voice.camera ? "kamera" : "kamera-kapali"} boyut={18} /></button>

    <button
      class="dugme"
      class:acik={voice.screen}
      aria-label={voice.screen ? "Ekran paylaşımını durdur" : "Ekran paylaş"}
      onclick={onToggleScreen}
    ><Icon ad="ekran" boyut={18} /></button>
  </div>
</div>

<style>
  .panel {
    margin-top: auto;
    background: var(--zemin-1); border: 1px solid var(--cizgi);
    border-radius: var(--radius); overflow: hidden;
  }
  .ust { display: flex; align-items: center; padding: 6px 6px 6px 8px; }
  .donus {
    display: flex; align-items: center; gap: 7px; flex: 1;
    min-width: 0; padding: 2px 0; text-align: left;
  }
  .nokta { width: 7px; height: 7px; border-radius: 50%; background: var(--online); flex: none; }
  .metin { display: grid; min-width: 0; }
  .durum { font-size: 11px; color: var(--online); line-height: 1.25; }
  .kanal {
    font-size: 11px; color: var(--metin-3); line-height: 1.25;
    overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
  }

  .alt {
    display: flex; gap: 2px; padding: 5px 6px;
    border-top: 1px solid var(--cizgi); background: var(--zemin-2);
  }
  .dugme {
    display: grid; place-items: center; height: 28px;
    color: var(--metin-2);
    transition: background var(--gecis), color var(--gecis);
  }
  .alt .dugme { flex: 1; }
  .dugme:hover { background: var(--zemin-1); color: var(--metin-1); }
  .dugme.acik { color: var(--bal-sicak); background: var(--bal-zemin); }
  .dugme.kapali { color: var(--tehlike); }
  .ust .dugme { width: 26px; height: 26px; }
  .dugme.ayril { color: var(--tehlike); }
  .dugme.ayril:hover { background: rgba(217, 88, 74, 0.14); color: var(--tehlike); }
</style>
