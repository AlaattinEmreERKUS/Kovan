<script lang="ts">
  import { store } from "$lib/store.svelte";
  import { voice } from "$lib/voice.svelte";

  let { onJoin, onLeave }: { onJoin: () => void; onLeave: () => void } = $props();

  const adlar = $derived(new Map(store.members.map((m) => [m.id, m.displayName])));

  // "failed" = ICE hicbir yol bulamadi, kalici. Kullanici bunu gormezse
  // mikrofonunu suclar; gercek sebep agin dogrudan baglantiya izin vermemesi.
  const kopuklar = $derived(
    voice.members.filter((m) => voice.connection.get(m.userId) === "failed")
  );
</script>

<div class="ses">
  <button
    class="kanal"
    class:aktif={voice.joined}
    aria-label={voice.joined ? "Ses kanalından ayrıl" : "Ses kanalına katıl"}
    onclick={() => (voice.joined ? onLeave() : onJoin())}
  >
    <span aria-hidden="true">♪</span> sohbet
    <span class="sayi">{voice.members.length}/4</span>
  </button>

  <ul>
    {#each voice.members as u (u.userId)}
      <li class:konusuyor={voice.speaking.has(u.userId)}>
        <span class="ad">{adlar.get(u.userId) ?? "…"}</span>
        {#if u.muted}<span class="rozet" aria-label="mikrofonu kapalı">🔇</span>{/if}
        {#if u.deafened}<span class="rozet" aria-label="kulaklığı kapalı">🎧</span>{/if}
        {#if u.camera}<span class="rozet" aria-label="kamerası açık">📷</span>{/if}
        {#if u.screen}<span class="rozet" aria-label="ekran paylaşıyor">🖥</span>{/if}
        {#if voice.connection.get(u.userId) === "failed"}
          <span class="rozet uyari" aria-label="bağlantı kurulamadı">⚠</span>
        {/if}
      </li>
    {/each}
  </ul>

  {#if kopuklar.length > 0}
    <p class="hata" role="alert">
      {kopuklar.map((m) => adlar.get(m.userId) ?? "…").join(", ")} ile bağlantı
      kurulamadı. Ağın doğrudan bağlantıya izin vermiyor olabilir; kablolu
      bağlantı veya farklı bir ağ deneyin.
    </p>
  {/if}

  {#if voice.error}
    <p class="hata" role="alert">{voice.error}</p>
  {/if}
</div>

<style>
  .kanal {
    width: 100%; display: flex; align-items: center; gap: 8px;
    text-align: left; padding: 6px 8px; color: var(--metin-2);
    transition: background var(--gecis), color var(--gecis);
  }
  .kanal:hover { background: var(--zemin-2); color: var(--metin-1); }
  .kanal.aktif { background: var(--bal-zemin); color: var(--bal-sicak); }
  .sayi { margin-left: auto; font-size: 11px; color: var(--metin-3); }
  ul { list-style: none; margin: 2px 0 0; padding: 0 0 0 18px; display: grid; gap: 2px; }
  li { display: flex; align-items: center; gap: 6px; font-size: 12px; color: var(--metin-2); }
  /* Konusma gostergesi spec 9'daki tek glow kullanimlarindan biri. */
  li.konusuyor .ad { color: var(--bal-sicak); text-shadow: 0 0 6px var(--bal-zemin); }
  .rozet { font-size: 10px; }
  .rozet.uyari { color: var(--tehlike); }
  .hata { margin: 8px 6px 0; font-size: 11px; color: var(--tehlike); line-height: 1.4; }
</style>
