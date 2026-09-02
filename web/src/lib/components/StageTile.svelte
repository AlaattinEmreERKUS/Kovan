<script lang="ts">
  import { attachStream } from "$lib/rtc/attach";
  import type { KisiKare } from "$lib/stage";
  import { SES_VARSAYILAN, SES_MAKS, type RemoteAudioMixer } from "$lib/rtc/gain";
  import Icon from "./Icon.svelte";

  let { kare, micMixer }: { kare: KisiKare; micMixer: RemoteAudioMixer | null } = $props();

  // Kendi sesini kisamazsin: kendi mikrofonun zaten calinmiyor.
  const sesAyari = $derived(!kare.kendisi && micMixer !== null);
  const kayitli = $derived(micMixer?.volumeOf(kare.userId) ?? SES_VARSAYILAN);
  let elle = $state<number | null>(null);
  const seviye = $derived(elle ?? kayitli);

  function degistir(v: number) {
    elle = v;
    micMixer?.setVolume(kare.userId, v);
  }
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

  {#if sesAyari}
    <div class="ses">
      <Icon ad="hoparlor" boyut={12} />
      <input
        type="range" min="0" max={SES_MAKS} step="5"
        value={seviye}
        aria-label={`${kare.ad} mikrofon seviyesi`}
        oninput={(e) => degistir(Number(e.currentTarget.value))}
      />
      <span class="deger">{seviye}</span>
    </div>
  {/if}

  <figcaption>
    <span class="ad">{kare.ad}{kare.kendisi ? " (sen)" : ""}</span>
    {#if kare.deafened}
      <span class="rozet kapali" role="img" aria-label="kulaklığı kapalı" title="Kulaklığı kapalı"><Icon ad="kulaklik-kapali" boyut={13} /></span>
    {:else if kare.muted}
      <span class="rozet kapali" role="img" aria-label="mikrofonu kapalı" title="Mikrofonu kapalı"><Icon ad="mik-kapali" boyut={13} /></span>
    {/if}
    {#if kare.kopuk}
      <span class="rozet uyari" role="img" aria-label="bağlantı kurulamadı" title="Bağlantı kurulamadı"><Icon ad="uyari" boyut={13} /></span>
    {/if}
  </figcaption>
</figure>

<style>
  /*
    Oran KARENIN kendisinde: video ile kutu ayni olculerde olmazsa izgara
    satiri kareyi uzatir ve videonun ALTINDA bos bir serit kalir. Onceki
    surumde tam olarak bu oluyordu (birden fazla kamera acikken belirgin).
  */
  figure {
    position: relative; margin: 0; overflow: hidden;
    aspect-ratio: 16 / 9; min-width: 0;
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
    display: block; width: 100%; height: 100%;
    object-fit: cover; background: var(--zemin-0);
  }
  /* Yalniz KENDI onizlemen aynalanir; karsiya giden track'e dokunmaz. */
  video.aynali { transform: scaleX(-1); }

  .bos {
    display: grid; place-items: center;
    width: 100%; height: 100%; background: var(--zemin-0);
  }
  .harf {
    display: grid; place-items: center;
    width: 22%; aspect-ratio: 1; min-width: 32px; max-width: 56px;
    border-radius: 50%;
    background: var(--bal-zemin); color: var(--bal-sicak);
    font-size: clamp(14px, 8cqw, 22px); font-weight: 600; line-height: 1;
    container-type: inline-size;
  }

  .ses {
    position: absolute; right: 6px; bottom: 6px;
    display: flex; align-items: center; gap: 5px;
    padding: 2px 7px; border-radius: var(--radius);
    background: rgba(0, 0, 0, 0.55); font-size: 11px;
    opacity: 0; transition: opacity var(--gecis);
  }
  figure:hover .ses, .ses:focus-within { opacity: 1; }
  .ses input { width: 70px; }
  .deger { min-width: 22px; text-align: right; color: var(--metin-2); }

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
