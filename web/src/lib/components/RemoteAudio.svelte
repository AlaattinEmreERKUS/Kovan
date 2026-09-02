<script lang="ts">
  import { attachStream } from "$lib/rtc/attach";
  import { voice } from "$lib/voice.svelte";
  import type { RemoteAudioMixer } from "$lib/rtc/gain";

  let { micMixer }: { micMixer: RemoteAudioMixer | null } = $props();

  const girisler = $derived([...voice.remote.entries()]);
</script>

<!--
  Gorunmez YEDEK yol. Uzak mikrofonlar normalde mikrofon mikserinden calinir
  (kisi bazli seviye 0-200% orada). AudioContext kurulamazsa mikser null
  kalir ve ses tamamen kesilirdi; o durumda bu <audio> elementleri devreye
  girer -- seviye ayari olmadan ama duyulur. Ikisi birden acik olursa ses
  CIFT duyulur, bu yuzden kosul sart.
  Deafen: mikser gain'i sifirlar, yedek yolda element susturulur.
-->
{#if micMixer === null}
  {#each girisler as [userId, tracks] (userId)}
    {#if tracks.mic}
      <audio use:attachStream={tracks.mic} autoplay muted={voice.deafened}></audio>
    {/if}
  {/each}
{/if}
