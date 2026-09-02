<script lang="ts">
  import VoiceChannel from "./VoiceChannel.svelte";
  import VoiceControls from "./VoiceControls.svelte";

  let { onJoin, onLeave, onToggleMute, onToggleDeafen, onToggleCamera }: {
    onJoin: () => void;
    onLeave: () => void;
    onToggleMute: () => void;
    onToggleDeafen: () => void;
    onToggleCamera: () => void;
  } = $props();
</script>

<nav>
  <div class="baslik">Kovan</div>
  <ul>
    <li><button class="kanal aktif"><span aria-hidden="true">#</span> genel</button></li>
  </ul>
  <VoiceChannel {onJoin} {onLeave} />
  <VoiceControls {onToggleMute} {onToggleDeafen} {onToggleCamera} />
</nav>

<style>
  nav { width: 190px; border-right: 1px solid var(--cizgi); padding: 14px 10px; background: var(--zemin-1); }
  .baslik { font-weight: 600; letter-spacing: 0.02em; padding: 0 6px 12px; }
  ul { list-style: none; margin: 0; padding: 0; display: grid; gap: 2px; }
  .kanal {
    width: 100%; text-align: left; padding: 6px 8px;
    color: var(--metin-2); transition: background var(--gecis), color var(--gecis);
  }
  .kanal:hover { background: var(--zemin-2); color: var(--metin-1); }
  .kanal.aktif { background: var(--bal-zemin); color: var(--bal-sicak); }
</style>
