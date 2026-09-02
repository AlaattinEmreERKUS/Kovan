<script lang="ts">
  import { attachStream } from "$lib/rtc/attach";
  import { SES_VARSAYILAN, SES_MAKS, type RemoteAudioMixer } from "$lib/rtc/gain";
  import Icon from "./Icon.svelte";

  let { track, label, userId, mixer, buyuk, onBuyut }: {
    track: MediaStreamTrack;
    label: string;
    userId: string;
    mixer: RemoteAudioMixer | null;
    buyuk: boolean;
    onBuyut: () => void;
  } = $props();

  // mixer prop'u oturum kurulunca null'dan gercek nesneye doner; kaydedilmis
  // seviye o anda okunmali, kare olusurken degil.
  const kayitli = $derived(mixer?.volumeOf(userId) ?? SES_VARSAYILAN);
  let elle = $state<number | null>(null);
  const seviye = $derived(elle ?? kayitli);

  function degistir(v: number) {
    elle = v;
    mixer?.setVolume(userId, v);
  }
</script>

<figure data-kare="ekran" data-user={userId} data-buyuk={buyuk}>
  <!-- svelte-ignore a11y_media_has_caption -->
  <video use:attachStream={track} autoplay playsinline muted></video>

  <div class="araclar">
    {#if mixer}
      <div class="ses">
        <Icon ad="hoparlor" boyut={13} />
        <input
          type="range" min="0" max={SES_MAKS} step="5"
          value={seviye}
          aria-label={`${label} ses seviyesi`}
          oninput={(e) => degistir(Number(e.currentTarget.value))}
        />
        <span class="deger">{seviye}</span>
      </div>
    {/if}
    <button
      class="buyut"
      aria-label={buyuk ? "Ekranı küçült" : "Ekranı büyüt"}
      onclick={onBuyut}
    ><Icon ad={buyuk ? "kucult" : "buyut"} boyut={15} /></button>
  </div>

  <figcaption>{label}</figcaption>
</figure>

<style>
  /*
    Kare kendi boyutunu DAYATMAZ: yuksekligi ana alan verir, video icine
    sigar. Onceki surumde video `aspect-ratio: 16/9` ile sabitti ve izgara
    satiri daha uzun oldugunda altta bos bir serit kaliyordu.
  */
  figure {
    position: relative; margin: 0; min-height: 0; overflow: hidden;
    border-radius: var(--radius); background: var(--zemin-0);
    border: 1px solid var(--cizgi);
  }
  video {
    display: block; width: 100%; height: 100%;
    object-fit: contain; background: var(--zemin-0);
  }

  .araclar {
    position: absolute; right: 6px; bottom: 6px;
    display: flex; align-items: center; gap: 6px;
    opacity: 0; transition: opacity var(--gecis);
  }
  figure:hover .araclar, .araclar:focus-within { opacity: 1; }

  .ses {
    display: flex; align-items: center; gap: 6px;
    padding: 3px 8px; border-radius: var(--radius);
    background: rgba(0, 0, 0, 0.55); font-size: 11px;
  }
  .deger { min-width: 24px; text-align: right; color: var(--metin-2); }

  .buyut {
    display: grid; place-items: center;
    width: 28px; height: 28px; padding: 0;
    border: none; border-radius: var(--radius);
    background: rgba(0, 0, 0, 0.55); color: var(--metin-1); cursor: pointer;
  }
  .buyut:hover { background: rgba(0, 0, 0, 0.75); color: var(--bal); }

  figcaption {
    position: absolute; left: 6px; bottom: 6px;
    padding: 2px 6px; border-radius: var(--radius);
    background: rgba(0, 0, 0, 0.55); font-size: 11px; color: var(--metin-1);
  }
</style>
