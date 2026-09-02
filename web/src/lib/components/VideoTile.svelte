<script lang="ts">
  import { attachStream } from "$lib/rtc/attach";
  import { SCREEN_VOLUME_DEFAULT, SCREEN_VOLUME_MAX, type ScreenAudioMixer } from "$lib/rtc/gain";
  import Icon from "./Icon.svelte";

  let { track, label, kind, userId, mixer }: {
    track: MediaStreamTrack;
    label: string;
    kind: "cam" | "screen";
    userId: string;
    mixer: ScreenAudioMixer | null;
  } = $props();

  // mixer prop'u oturum kurulunca null'dan gercek nesneye doner; kaydedilmis
  // seviye o anda okunmali, kare olusurken degil.
  const kayitli = $derived(mixer?.volumeOf(userId) ?? SCREEN_VOLUME_DEFAULT);
  let elle = $state<number | null>(null);
  const seviye = $derived(elle ?? kayitli);

  function degistir(v: number) {
    elle = v;
    mixer?.setVolume(userId, v);
  }
</script>

<figure class:ekran={kind === "screen"} data-kare="ekran" data-user={userId}>
  <!-- svelte-ignore a11y_media_has_caption -->
  <video use:attachStream={track} autoplay playsinline muted></video>
  {#if kind === "screen" && mixer}
    <div class="ses">
      <Icon ad="hoparlor" boyut={13} />
      <input
        type="range" min="0" max={SCREEN_VOLUME_MAX} step="5"
        value={seviye}
        aria-label={`${label} ses seviyesi`}
        oninput={(e) => degistir(Number(e.currentTarget.value))}
      />
      <span class="deger">{seviye}</span>
    </div>
  {/if}
  <figcaption>{label}</figcaption>
</figure>

<style>
  figure {
    position: relative; margin: 0; overflow: hidden;
    border-radius: var(--radius); background: var(--zemin-2);
    border: 1px solid var(--cizgi);
  }
  figure.ekran { grid-column: span 2; }
  video { display: block; width: 100%; aspect-ratio: 16 / 9; object-fit: contain; background: var(--zemin-0); }
  .ses {
    position: absolute; right: 6px; bottom: 6px;
    display: flex; align-items: center; gap: 6px;
    padding: 3px 8px; border-radius: var(--radius);
    background: rgba(0, 0, 0, 0.55); font-size: 11px;
    opacity: 0; transition: opacity var(--gecis);
  }
  figure:hover .ses, .ses:focus-within { opacity: 1; }
  .deger { min-width: 24px; text-align: right; color: var(--metin-2); }
  figcaption {
    position: absolute; left: 6px; bottom: 6px;
    padding: 2px 6px; border-radius: var(--radius);
    background: rgba(0, 0, 0, 0.55); font-size: 11px; color: var(--metin-1);
  }
</style>
