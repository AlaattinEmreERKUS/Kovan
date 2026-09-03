<script lang="ts">
  import { voice } from "$lib/voice.svelte";
  import VoiceChannel from "./VoiceChannel.svelte";
  import VoicePanel from "./VoicePanel.svelte";
  import Icon from "./Icon.svelte";

  let {
    aktifSekme, onMetinSekmesi, onJoin, onSahneyeDon, onLeave,
    onToggleMute, onToggleDeafen, onToggleCamera, onToggleScreen,
  }: {
    aktifSekme: "metin" | "ses";
    onMetinSekmesi: () => void;
    onJoin: () => void;
    onSahneyeDon: () => void;
    onLeave: () => void;
    onToggleMute: () => void;
    onToggleDeafen: () => void;
    onToggleCamera: () => void;
    onToggleScreen: () => void;
  } = $props();
</script>

<nav>
  <div class="baslik">Kovan</div>

  <ul>
    <li>
      <button
        class="kanal"
        class:aktif={aktifSekme === "metin"}
        aria-label="Metin kanalı: genel"
        onclick={onMetinSekmesi}
      ><Icon ad="kanal-metin" boyut={14} /> genel</button>
    </li>
  </ul>

  <VoiceChannel {onJoin} {onSahneyeDon} />

  <!-- Panel yalniz metin sekmesindeyken; sahnedeyken kontroller altta. -->
  {#if voice.joined && aktifSekme === "metin"}
    <VoicePanel
      {onToggleMute}
      {onToggleDeafen}
      {onToggleCamera}
      {onToggleScreen}
      {onLeave}
      {onSahneyeDon}
    />
  {/if}
</nav>

<style>
  nav {
    width: 190px; display: flex; flex-direction: column;
    border-right: 1px solid var(--cizgi); padding: 14px 10px;
    background: var(--zemin-1); flex: none;
    /* Uye listesiyle ayni kural: tasma sutunun icinde kalir. */
    min-height: 0; overflow-y: auto; overscroll-behavior: contain;
  }
  .baslik { font-weight: 600; letter-spacing: 0.02em; padding: 0 6px 12px; }
  ul { list-style: none; margin: 0; padding: 0; display: grid; gap: 2px; }
  .kanal {
    width: 100%; display: flex; align-items: center; gap: 8px;
    text-align: left; padding: 6px 8px; color: var(--metin-2);
    transition: background var(--gecis), color var(--gecis);
  }
  .kanal:hover { background: var(--zemin-2); color: var(--metin-1); }
  .kanal.aktif { background: var(--bal-zemin); color: var(--bal-sicak); }
</style>
