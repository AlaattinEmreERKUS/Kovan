<script lang="ts">
  import type { MessageGroupItem } from "$lib/gruplama";
  import { store } from "$lib/store.svelte";
  import ReactionBar from "./ReactionBar.svelte";

  let { grup, onToggleReaction }: {
    grup: MessageGroupItem;
    onToggleReaction: (messageId: number, emoji: string) => void;
  } = $props();

  const yazar = $derived(store.members.find((u) => u.id === grup.authorId));
  const bas = $derived(yazar?.displayName.slice(0, 1).toUpperCase() ?? "?");
  const saat = $derived(
    new Date(grup.startedAt).toLocaleTimeString("tr-TR", { hour: "2-digit", minute: "2-digit" })
  );
</script>

<article class="grup">
  <div class="avatar" aria-hidden="true">{bas}</div>
  <div class="govde">
    <header>
      <span class="ad">{yazar?.displayName ?? "Bilinmeyen"}</span>
      <time class="saat">{saat}</time>
    </header>
    {#each grup.messages as m (m.id)}
      <div class="mesaj">
        <p>{m.content}</p>
        <ReactionBar messageId={m.id} onToggle={(e) => onToggleReaction(m.id, e)} />
      </div>
    {/each}
  </div>
</article>

<style>
  .grup { display: grid; grid-template-columns: 36px 1fr; gap: 12px; padding: 6px 16px; }
  .grup:hover { background: var(--zemin-1); }
  .avatar {
    width: 36px; height: 36px; border-radius: var(--radius);
    background: var(--zemin-2); border: 1px solid var(--cizgi);
    display: grid; place-items: center; font-weight: 600; color: var(--metin-2);
  }
  header { display: flex; gap: 8px; align-items: baseline; }
  .ad { font-weight: 600; }
  .saat { font-family: var(--yazi-mono); font-size: 11px; color: var(--metin-3); }
  .mesaj p { margin: 2px 0 0; white-space: pre-wrap; overflow-wrap: anywhere; }
</style>
