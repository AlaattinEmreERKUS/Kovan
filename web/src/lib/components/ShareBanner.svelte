<script lang="ts">
  import { voice } from "$lib/voice.svelte";
  let { onStop }: { onStop: () => void } = $props();
</script>

{#if voice.screen}
  <div class="serit" role="status">
    <span class="nokta" aria-hidden="true"></span>
    <span>Ekranını paylaşıyorsun</span>
    {#if voice.screenAudio}<span class="ek">· sistem sesi açık</span>{/if}
    <button onclick={onStop}>Durdur</button>
  </div>
{/if}

<style>
  /*
    Serit kanal basliginin ALTINDA durur. Ekranin ust kenarinda Chromium'un
    kendi paylasim cubugu var (gizlenemiyor, spec 8.1 kisit 2); iki kopya gibi
    gorunmemesi gerekiyor.
  */
  .serit {
    display: flex; align-items: center; gap: 8px;
    padding: 6px 16px; font-size: 12px;
    background: var(--bal-zemin); color: var(--bal-sicak);
    border-bottom: 1px solid var(--cizgi);
  }
  .nokta {
    width: 7px; height: 7px; border-radius: 50%;
    background: var(--bal); box-shadow: 0 0 6px var(--bal);
  }
  .ek { color: var(--metin-2); }
  button { margin-left: auto; padding: 2px 10px; color: var(--bal-sicak); }
  button:hover { background: var(--zemin-2); }
</style>
