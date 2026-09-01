<script lang="ts">
  import { store } from "$lib/store.svelte";

  let { onSend, onTyping }: { onSend: (metin: string) => void; onTyping: () => void } = $props();
  let metin = $state("");

  const yazanlar = $derived(
    [...store.typingUserIds]
      .filter((id) => id !== store.me?.id)
      .map((id) => store.members.find((u) => u.id === id)?.displayName)
      .filter((ad): ad is string => ad !== undefined)
  );

  // Baglanti acilmadan yazilan mesaj sessizce kaybolurdu: SSR ile gelen HTML'de
  // kutu goruntuleniyor ama olay isleyicileri hidrasyon bitene kadar bagli
  // degil. Kutu kapaliyken kullanici bunu goruyor.
  const hazir = $derived(store.durum === "acik");

  function tusla(e: KeyboardEvent) {
    if (e.key !== "Enter" || e.shiftKey) return;
    e.preventDefault();
    const gonderilecek = metin.trim();
    if (gonderilecek.length === 0) return;
    onSend(gonderilecek);
    metin = "";
  }
</script>

<div class="alan">
  <textarea
    bind:value={metin}
    onkeydown={tusla}
    oninput={onTyping}
    rows="1"
    disabled={!hazir}
    placeholder={hazir ? "Bir mesaj yaz…" : "Bağlanıyor…"}
    aria-label="Mesaj yaz"
  ></textarea>
  <div class="yaziyor" aria-live="polite">
    {#if yazanlar.length > 0}{yazanlar.join(", ")} yazıyor…{/if}
  </div>
</div>

<style>
  .alan { padding: 0 16px 12px; }
  textarea {
    width: 100%; resize: none; padding: 11px 12px;
    background: var(--zemin-2); color: var(--metin-1);
    border: 1px solid var(--cizgi); border-radius: var(--radius);
    font: inherit; transition: border-color var(--gecis);
  }
  textarea:focus { outline: none; border-color: var(--bal); }
  textarea:disabled { opacity: 0.6; cursor: progress; }
  .yaziyor { height: 18px; padding-top: 3px; font-size: 12px; color: var(--metin-3); }
</style>
