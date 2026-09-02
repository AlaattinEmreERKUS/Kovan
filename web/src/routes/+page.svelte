<script lang="ts">
  import { onMount, onDestroy } from "svelte";
  import { goto } from "$app/navigation";
  import { PUBLIC_API_URL, PUBLIC_WS_URL } from "$env/static/public";
  import { Connection } from "$lib/connection.svelte";
  import { store } from "$lib/store.svelte";
  import { voice } from "$lib/voice.svelte";
  import { VoiceSession } from "$lib/rtc/session";
  import ChannelRail from "$lib/components/ChannelRail.svelte";
  import MessageList from "$lib/components/MessageList.svelte";
  import Composer from "$lib/components/Composer.svelte";
  import MemberList from "$lib/components/MemberList.svelte";
  import RemoteAudio from "$lib/components/RemoteAudio.svelte";
  import VideoGrid from "$lib/components/VideoGrid.svelte";
  import ShareBanner from "$lib/components/ShareBanner.svelte";
  import ShareDialog from "$lib/components/ShareDialog.svelte";
  import type { ShareOptions } from "$lib/rtc/share";

  let baglanti: Connection | null = null;
  let oturum: VoiceSession | null = null;
  let paylasimDiyalogu = $state(false);

  function ekranDugmesi() {
    if (voice.screen) oturum?.stopScreen();
    else paylasimDiyalogu = true;
  }

  async function paylasimOnayi(o: ShareOptions) {
    paylasimDiyalogu = false;
    await oturum?.startScreen(o);
  }

  onMount(() => {
    const token = localStorage.getItem("kovan_token");
    if (token === null) { void goto("/giris"); return; }
    baglanti = new Connection(PUBLIC_WS_URL, token);
  });

  // selfId hello gelene kadar bilinmiyor; oturum store.me dolunca kurulur.
  $effect(() => {
    if (!baglanti || !store.me || oturum) return;
    oturum = new VoiceSession({
      conn: baglanti,
      selfId: store.me.id,
      apiUrl: PUBLIC_API_URL,
      token: localStorage.getItem("kovan_token") ?? "",
    });
    if (import.meta.env.DEV) {
      // Playwright kancasi: yalnizca dev build'de tanimlanir.
      (window as unknown as { __kovan?: unknown }).__kovan = { oturum, voice };
    }
  });

  onDestroy(() => { oturum?.destroy(); baglanti?.close(); });

  function gonder(metin: string) {
    baglanti?.send({ t: "msg.send", content: metin, localId: crypto.randomUUID() });
  }
  function tepki(messageId: number, emoji: string) {
    baglanti?.send({ t: "reaction.toggle", messageId, emoji });
  }
</script>

<div class="kabuk">
  <ChannelRail
    onJoin={() => void oturum?.join()}
    onLeave={() => oturum?.leave()}
    onToggleMute={() => oturum?.setMuted(!voice.muted)}
    onToggleDeafen={() => oturum?.setDeafened(!voice.deafened)}
    onToggleCamera={() => void oturum?.setCamera(!voice.camera)}
    onToggleScreen={ekranDugmesi}
  />
  <main>
    <header class="ust">
      <span aria-hidden="true">#</span> genel
      {#if store.durum !== "acik"}
        <span class="durum">{store.durum === "baglaniyor" ? "bağlanıyor…" : "bağlantı koptu"}</span>
      {/if}
    </header>
    <ShareBanner onStop={() => oturum?.stopScreen()} />
    <VideoGrid />
    <MessageList onToggleReaction={tepki} />
    <Composer onSend={gonder} onTyping={() => baglanti?.typing()} />
  </main>
  <MemberList />
  <RemoteAudio />
  <ShareDialog
    open={paylasimDiyalogu}
    onConfirm={paylasimOnayi}
    onCancel={() => (paylasimDiyalogu = false)}
  />
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
