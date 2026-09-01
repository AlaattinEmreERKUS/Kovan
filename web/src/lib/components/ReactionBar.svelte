<script lang="ts">
  import { store } from "$lib/store.svelte";
  let { messageId, onToggle }: { messageId: number; onToggle: (emoji: string) => void } = $props();

  const HIZLI = ["👍", "🔥", "😂", "❤️"];

  const mevcut = $derived(
    [...store.reactions.entries()]
      .filter(([k, ids]) => k.startsWith(`${messageId}|`) && ids.length > 0)
      .map(([k, ids]) => ({ emoji: k.split("|")[1], ids }))
  );
</script>

<div class="satir">
  {#each mevcut as r (r.emoji)}
    <button
      class="rozet"
      class:benim={store.me !== null && r.ids.includes(store.me.id)}
      onclick={() => onToggle(r.emoji)}
      aria-label="{r.emoji} tepkisi, {r.ids.length} kişi"
    >
      <span>{r.emoji}</span><span class="sayi">{r.ids.length}</span>
    </button>
  {/each}
  <div class="hizli">
    {#each HIZLI as e (e)}
      <button class="ekle" onclick={() => onToggle(e)} aria-label="{e} ekle">{e}</button>
    {/each}
  </div>
</div>

<style>
  .satir { display: flex; gap: 4px; align-items: center; margin-top: 4px; }
  .rozet {
    display: flex; gap: 5px; align-items: center;
    padding: 2px 7px; border: 1px solid var(--cizgi);
    background: var(--zemin-2); font-size: 12px;
    transition: border-color var(--gecis);
  }
  .rozet.benim { border-color: var(--bal); background: var(--bal-zemin); }
  .sayi { color: var(--metin-2); font-family: var(--yazi-mono); }
  .hizli { display: flex; gap: 2px; opacity: 0; transition: opacity var(--gecis); }
  .satir:hover .hizli, .satir:focus-within .hizli { opacity: 1; }
  .ekle { padding: 2px 5px; font-size: 12px; }
  .ekle:hover { background: var(--zemin-2); }
</style>
