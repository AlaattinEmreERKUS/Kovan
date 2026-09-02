<script lang="ts">
  import { attachStream } from "$lib/rtc/attach";
  import type { KisiKare } from "$lib/stage";
  import Icon from "./Icon.svelte";

  let { kare }: { kare: KisiKare } = $props();
</script>

<figure
  data-kare="kisi"
  data-user={kare.userId}
  data-kendisi={kare.kendisi}
  class:konusuyor={kare.konusuyor}
>
  {#if kare.track}
    <!-- svelte-ignore a11y_media_has_caption -->
    <video
      use:attachStream={kare.track}
      autoplay
      playsinline
      muted
      class:aynali={kare.kendisi}
    ></video>
  {:else}
    <div class="bos"><span class="harf" aria-hidden="true">{kare.harf}</span></div>
  {/if}

  <figcaption>
    <span class="ad">{kare.ad}{kare.kendisi ? " (sen)" : ""}</span>
    {#if kare.deafened}
      <span class="rozet kapali" title="Kulaklığı kapalı"><Icon ad="kulaklik-kapali" boyut={13} /></span>
    {:else if kare.muted}
      <span class="rozet kapali" title="Mikrofonu kapalı"><Icon ad="mik-kapali" boyut={13} /></span>
    {/if}
    {#if kare.kopuk}
      <span class="rozet uyari" title="Bağlantı kurulamadı"><Icon ad="uyari" boyut={13} /></span>
    {/if}
  </figcaption>
</figure>

<style>
  figure {
    position: relative; margin: 0; overflow: hidden;
    border-radius: var(--radius); background: var(--zemin-2);
    border: 1px solid var(--cizgi);
    transition: border-color var(--gecis), box-shadow var(--gecis);
  }
  /* Konusma gostergesi spec 9'daki tek glow kullanimlarindan biri. */
  figure.konusuyor {
    border-color: var(--bal);
    box-shadow: 0 0 0 1px var(--bal), 0 0 12px var(--bal-zemin);
  }

  video {
    display: block; width: 100%; aspect-ratio: 16 / 9;
    object-fit: cover; background: var(--zemin-0);
  }
  /* Yalniz KENDI onizlemen aynalanir; karsiya giden track'e dokunmaz. */
  video.aynali { transform: scaleX(-1); }

  .bos {
    display: grid; place-items: center;
    width: 100%; aspect-ratio: 16 / 9; background: var(--zemin-0);
  }
  .harf {
    display: grid; place-items: center;
    width: 56px; height: 56px; border-radius: 50%;
    background: var(--bal-zemin); color: var(--bal-sicak);
    font-size: 22px; font-weight: 600; line-height: 1;
  }

  figcaption {
    position: absolute; left: 6px; bottom: 6px;
    display: flex; align-items: center; gap: 5px;
    max-width: calc(100% - 12px);
    padding: 2px 7px; border-radius: var(--radius);
    background: rgba(0, 0, 0, 0.55); font-size: 11px; color: var(--metin-1);
  }
  .ad { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .rozet { display: flex; }
  .rozet.kapali { color: var(--tehlike); }
  .rozet.uyari { color: var(--tehlike); }
</style>
