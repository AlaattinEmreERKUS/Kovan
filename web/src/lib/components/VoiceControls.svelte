<script lang="ts">
  import { voice } from "$lib/voice.svelte";

  let { onToggleMute, onToggleDeafen, onToggleCamera }: {
    onToggleMute: () => void;
    onToggleDeafen: () => void;
    onToggleCamera: () => void;
  } = $props();
</script>

{#if voice.joined}
  <div class="cubuk">
    <button
      class:kapali={voice.muted}
      aria-label={voice.muted ? "Mikrofonu aç" : "Mikrofonu kapat"}
      onclick={onToggleMute}
    >{voice.muted ? "🔇" : "🎙"}</button>

    <button
      class:kapali={voice.deafened}
      aria-label={voice.deafened ? "Kulaklığı aç" : "Kulaklığı kapat"}
      onclick={onToggleDeafen}
    >🎧</button>

    <button
      class:acik={voice.camera}
      aria-label={voice.camera ? "Kamerayı kapat" : "Kamerayı aç"}
      onclick={onToggleCamera}
    >📷</button>
  </div>
{/if}

<style>
  .cubuk {
    display: flex; gap: 4px; margin-top: 10px; padding: 6px;
    background: var(--zemin-2); border-radius: var(--radius);
  }
  button {
    flex: 1; padding: 6px 0; font-size: 14px;
    transition: background var(--gecis), color var(--gecis);
  }
  button:hover { background: var(--zemin-1); }
  button.kapali { color: var(--tehlike); }
  button.acik { color: var(--bal-sicak); }
</style>
