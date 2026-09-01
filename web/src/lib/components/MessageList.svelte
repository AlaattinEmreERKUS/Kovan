<script lang="ts">
  import { groupMessages } from "$lib/gruplama";
  import { store } from "$lib/store.svelte";
  import MessageGroup from "./MessageGroup.svelte";

  let { onToggleReaction }: { onToggleReaction: (id: number, emoji: string) => void } = $props();
  let kutu: HTMLDivElement | undefined = $state();

  const gruplar = $derived(groupMessages(store.messages));

  // Yeni mesajda en alta kaydır.
  $effect(() => {
    void store.messages.length;
    kutu?.scrollTo({ top: kutu.scrollHeight });
  });
</script>

<div class="liste" bind:this={kutu} role="log" aria-live="polite" aria-label="Mesajlar">
  {#each gruplar as g (g.messages[0].id)}
    <MessageGroup grup={g} {onToggleReaction} />
  {/each}
</div>

<style>
  .liste { flex: 1; overflow-y: auto; padding: 12px 0; }
</style>
