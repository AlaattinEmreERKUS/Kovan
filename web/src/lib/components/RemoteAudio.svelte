<script lang="ts">
  import { attachStream, cikisaBagla } from "$lib/rtc/attach";
  import { voice } from "$lib/voice.svelte";
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
{#if voice.mikMikseri === null}
  {#each girisler as [userId, tracks] (userId)}
    {#if tracks.mic}
      <audio
        data-kovan="yedek"
        use:attachStream={tracks.mic}
        use:cikisaBagla={voice.cikisCihazi}
        autoplay
        muted={voice.deafened}
      ></audio>
    {/if}
  {/each}
{/if}
