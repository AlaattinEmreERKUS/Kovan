<script lang="ts">
  import { onMount, onDestroy } from "svelte";
  import { goto } from "$app/navigation";
  import { PUBLIC_WS_URL } from "$env/static/public";
  import { Connection } from "$lib/connection.svelte";
  import { store } from "$lib/store.svelte";
  import ChannelRail from "$lib/components/ChannelRail.svelte";
  import MessageList from "$lib/components/MessageList.svelte";
  import Composer from "$lib/components/Composer.svelte";
  import MemberList from "$lib/components/MemberList.svelte";

  let baglanti: Connection | null = null;

  onMount(() => {
    const token = localStorage.getItem("kovan_token");
    if (token === null) { void goto("/giris"); return; }
    baglanti = new Connection(PUBLIC_WS_URL, token);
  });

  onDestroy(() => baglanti?.close());

  function gonder(metin: string) {
    baglanti?.send({ t: "msg.send", content: metin, localId: crypto.randomUUID() });
  }
  function tepki(messageId: number, emoji: string) {
    baglanti?.send({ t: "reaction.toggle", messageId, emoji });
  }
</script>

<div class="kabuk">
  <ChannelRail />
  <main>
    <header class="ust">
      <span aria-hidden="true">#</span> genel
      {#if store.durum !== "acik"}
        <span class="durum">{store.durum === "baglaniyor" ? "bağlanıyor…" : "bağlantı koptu"}</span>
      {/if}
    </header>
    <MessageList onToggleReaction={tepki} />
    <Composer onSend={gonder} onTyping={() => baglanti?.typing()} />
  </main>
  <MemberList />
</div>

<style>
  .kabuk { display: flex; height: 100vh; }
  main { flex: 1; display: flex; flex-direction: column; min-width: 0; }
  .ust {
    display: flex; align-items: center; gap: 8px;
    padding: 12px 16px; border-bottom: 1px solid var(--cizgi); font-weight: 600;
  }
  .durum { margin-left: auto; font-size: 12px; font-weight: 400; color: var(--tehlike); }
</style>
