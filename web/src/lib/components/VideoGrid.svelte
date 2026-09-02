<script lang="ts">
  import { store } from "$lib/store.svelte";
  import { voice } from "$lib/voice.svelte";
  import VideoTile from "./VideoTile.svelte";

  const adlar = $derived(new Map(store.members.map((m) => [m.id, m.displayName])));

  interface Kare {
    anahtar: string;
    userId: string;
    track: MediaStreamTrack;
    label: string;
    kind: "cam" | "screen";
  }

  const kareler = $derived.by<Kare[]>(() => {
    const liste: Kare[] = [];
    for (const [userId, t] of voice.remote) {
      const ad = adlar.get(userId) ?? "…";
      if (t.screenVideo) {
        liste.push({ anahtar: `${userId}-screen`, userId, track: t.screenVideo, label: `${ad} — ekran`, kind: "screen" });
      }
      if (t.cam) {
        liste.push({ anahtar: `${userId}-cam`, userId, track: t.cam, label: ad, kind: "cam" });
      }
    }
    return liste;
  });
</script>

{#if kareler.length > 0}
  <div class="izgara">
    {#each kareler as k (k.anahtar)}
      <VideoTile track={k.track} label={k.label} kind={k.kind} userId={k.userId} />
    {/each}
  </div>
{/if}

<style>
  .izgara {
    display: grid; gap: 8px; padding: 10px 16px;
    grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
    border-bottom: 1px solid var(--cizgi);
    max-height: 55vh; overflow-y: auto;
  }
</style>
