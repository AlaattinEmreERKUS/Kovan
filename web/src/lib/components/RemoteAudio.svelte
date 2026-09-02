<script lang="ts">
  import { attachStream } from "$lib/rtc/attach";
  import { voice } from "$lib/voice.svelte";

  const girisler = $derived([...voice.remote.entries()]);
</script>

<!--
  Gorunmez. Uzak mikrofonlar burada calinir; video kareleri (VideoTile) `muted`
  oldugu icin ses oradan gelmez. Bu katman olmadan uzak track bir media
  element'ine hic baglanmaz ve Chrome'da Web Audio grafigine de veri akmaz.
  Deafen tum uzak sesleri susturur.
-->
{#each girisler as [userId, tracks] (userId)}
  {#if tracks.mic}
    <audio use:attachStream={tracks.mic} autoplay muted={voice.deafened}></audio>
  {/if}
{/each}
