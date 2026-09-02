<script lang="ts">
  import { store } from "$lib/store.svelte";
  import { voice } from "$lib/voice.svelte";
  import { sahneKareleri } from "$lib/stage";
  import { gorunumOku, gorunumYaz, type GorunumModu } from "$lib/gorunum";
  import type { ScreenAudioMixer } from "$lib/rtc/gain";
  import StageTile from "./StageTile.svelte";
  import VideoTile from "./VideoTile.svelte";
  import VoiceControls from "./VoiceControls.svelte";

  let { selfId, mixer, onToggleMute, onToggleDeafen, onToggleCamera, onToggleScreen, onLeave }: {
    selfId: string;
    mixer: ScreenAudioMixer | null;
    onToggleMute: () => void;
    onToggleDeafen: () => void;
    onToggleCamera: () => void;
    onToggleScreen: () => void;
    onLeave: () => void;
  } = $props();

  let mod = $state<GorunumModu>(gorunumOku());

  function gorunumDegistir() {
    mod = mod === "herkes" ? "video" : "herkes";
    gorunumYaz(mod);
  }

  const adlar = $derived(new Map(store.members.map((m) => [m.id, m.displayName])));

  const kareler = $derived(sahneKareleri({
    members: voice.members,
    remote: voice.remote,
    local: voice.local,
    speaking: voice.speaking,
    connection: voice.connection,
    adlar,
    selfId,
    selfMuted: voice.muted,
    selfDeafened: voice.deafened,
    mod,
  }));
</script>

<section class="sahne">
  <div class="alan">
    {#if kareler.length === 0}
      <!-- Bos siyah alan bozukluk gibi okunur; sebebini yaz. -->
      <p class="bos">Kimsenin kamerası açık değil.</p>
    {:else}
      <div class="izgara">
        {#each kareler as k (k.anahtar)}
          {#if k.tur === "ekran"}
            <VideoTile
              track={k.track}
              label={k.kendisi ? `${k.ad} — ekranın` : `${k.ad} — ekran`}
              kind="screen"
              userId={k.userId}
              mixer={k.kendisi ? null : mixer}
            />
          {:else}
            <StageTile kare={k} />
          {/if}
        {/each}
      </div>
    {/if}
  </div>

  <VoiceControls
    {mod}
    {onToggleMute}
    {onToggleDeafen}
    {onToggleCamera}
    {onToggleScreen}
    onToggleGorunum={gorunumDegistir}
    {onLeave}
  />
</section>

<style>
  .sahne { flex: 1; display: flex; flex-direction: column; min-height: 0; }
  .alan { flex: 1; overflow-y: auto; padding: 14px 16px; }
  .izgara {
    display: grid; gap: 10px;
    grid-template-columns: repeat(auto-fit, minmax(240px, 1fr));
    align-content: start;
  }
  .bos {
    height: 100%; display: grid; place-items: center;
    margin: 0; color: var(--metin-3); font-size: 13px;
  }
</style>
