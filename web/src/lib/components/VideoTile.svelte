<script lang="ts">
  import { attachStream } from "$lib/rtc/attach";

  // `userId` Task 18'de ses kaydiricisi tarafindan kullanilacak.
  let { track, label, kind, userId }: {
    track: MediaStreamTrack;
    label: string;
    kind: "cam" | "screen";
    userId: string;
  } = $props();
</script>

<figure class:ekran={kind === "screen"} data-user={userId}>
  <!-- svelte-ignore a11y_media_has_caption -->
  <video use:attachStream={track} autoplay playsinline muted></video>
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
  figcaption {
    position: absolute; left: 6px; bottom: 6px;
    padding: 2px 6px; border-radius: var(--radius);
    background: rgba(0, 0, 0, 0.55); font-size: 11px; color: var(--metin-1);
  }
</style>
