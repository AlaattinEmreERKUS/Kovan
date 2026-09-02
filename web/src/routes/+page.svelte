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
  import VoiceStage from "$lib/components/VoiceStage.svelte";
  import ShareBanner from "$lib/components/ShareBanner.svelte";
  import ShareDialog from "$lib/components/ShareDialog.svelte";
  import Icon from "$lib/components/Icon.svelte";
  import type { ShareOptions } from "$lib/rtc/share";

  let baglanti: Connection | null = null;
  // $state sart: oturum atandiginda VoiceStage'in mixer prop'u guncellenmeli.
  let oturum = $state<VoiceSession | null>(null);
  let paylasimDiyalogu = $state(false);
  let aktifSekme = $state<"metin" | "ses">("metin");

  async function katil() {
    await oturum?.join();
    // join basarisiz olduysa (mikrofon izni yok) sahneye gecme.
    if (voice.joined) aktifSekme = "ses";
  }

  function ayril() {
    oturum?.leave();
    aktifSekme = "metin";
  }

  // Baglanti koparsa resetVoice joined'i dusurur; sahne kilitli kalmamali.
  $effect(() => {
    if (!voice.joined && aktifSekme === "ses") aktifSekme = "metin";
  });

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
    {aktifSekme}
    onMetinSekmesi={() => (aktifSekme = "metin")}
    onJoin={() => void katil()}
    onSahneyeDon={() => (aktifSekme = "ses")}
    onLeave={ayril}
    onToggleMute={() => oturum?.setMuted(!voice.muted)}
    onToggleDeafen={() => oturum?.setDeafened(!voice.deafened)}
    onToggleCamera={() => void oturum?.setCamera(!voice.camera)}
    onToggleScreen={ekranDugmesi}
  />
  <main>
    <header class="ust">
      {#if aktifSekme === "ses"}
        <Icon ad="kanal-ses" boyut={15} /> sohbet
      {:else}
        <Icon ad="kanal-metin" boyut={15} /> genel
      {/if}
      {#if store.durum !== "acik"}
        <span class="durum">{store.durum === "baglaniyor" ? "bağlanıyor…" : "bağlantı koptu"}</span>
      {/if}
    </header>

    <!--
      Serit HER IKI sekmede de gorunur: ekranini paylasirken sohbete
      donmen paylasimin durdurma dugmesini kaybetmeni gerektirmez.
      e2e/screen.spec.ts bunu sahnedeyken getByRole("status") ile ariyor.
    -->
    <ShareBanner onStop={() => oturum?.stopScreen()} />

    {#if aktifSekme === "ses" && voice.joined && store.me}
      <VoiceStage
        selfId={store.me.id}
        mixer={oturum?.mixer ?? null}
        onToggleMute={() => oturum?.setMuted(!voice.muted)}
        onToggleDeafen={() => oturum?.setDeafened(!voice.deafened)}
        onToggleCamera={() => void oturum?.setCamera(!voice.camera)}
        onToggleScreen={ekranDugmesi}
        onLeave={ayril}
      />
    {:else}
      <MessageList onToggleReaction={tepki} />
      <Composer onSend={gonder} onTyping={() => baglanti?.typing()} />
    {/if}
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
