<script lang="ts">
  import { store } from "$lib/store.svelte";
  import { voice } from "$lib/voice.svelte";
  import { sahneDuzeni } from "$lib/stage";
  import { izgaraOlcusu } from "$lib/izgara";
  import type { SesAyarlari } from "$lib/ses-ayarlari";
  import { gorunumOku, gorunumYaz, type GorunumModu } from "$lib/gorunum";
  import StageTile from "./StageTile.svelte";
  import VideoTile from "./VideoTile.svelte";
  import VoiceControls from "./VoiceControls.svelte";

  let { selfId, onToggleMute, onToggleDeafen, onToggleCamera, onToggleScreen, onSesAyari, onLeave }: {
    selfId: string;
    onToggleMute: () => void;
    onToggleDeafen: () => void;
    onToggleCamera: () => void;
    onToggleScreen: () => void;
    onSesAyari: (a: SesAyarlari) => void;
    onLeave: () => void;
  } = $props();

  let mod = $state<GorunumModu>(gorunumOku());
  /**
   * Buyutulmus ekranin anahtari. TARAYICI ICI buyutme: Fullscreen API
   * kullanilmiyor, sahne uygulamanin ustune yayiliyor. Kontrol cubugu ve
   * Esc her zaman erisilebilir kaliyor.
   */
  let buyutulen = $state<string | null>(null);

  function gorunumDegistir() {
    mod = mod === "herkes" ? "video" : "herkes";
    gorunumYaz(mod);
  }

  const adlar = $derived(new Map(store.members.map((m) => [m.id, m.displayName])));

  const duzen = $derived(sahneDuzeni({
    members: voice.members,
    remote: voice.remote,
    local: voice.local,
    speaking: voice.speaking,
    connection: voice.connection,
    adlar,
    selfId,
    selfMuted: voice.muted,
    selfDeafened: voice.deafened,
    mod,
  }));

  // Paylasim biterse buyutme durumu asili kalmamali.
  const buyukKare = $derived(duzen.ekranlar.find((e) => e.anahtar === buyutulen) ?? null);
  $effect(() => {
    if (buyutulen !== null && buyukKare === null) buyutulen = null;
  });

  const gosterilenEkranlar = $derived(buyukKare ? [buyukKare] : duzen.ekranlar);
  /** Ekran paylasiliyorsa kisiler serite iner; yoksa ana alanda galeri olur. */
  const seritte = $derived(duzen.ekranlar.length > 0);

  // Galeri olculeri: sutun sayisi genislik VE yukseklikten turetiliyor.
  let alanEn = $state(0);
  let alanBoy = $state(0);
  const olcu = $derived(izgaraOlcusu(duzen.kisiler.length, alanEn, alanBoy));

  function tusla(e: KeyboardEvent) {
    if (e.key === "Escape" && buyutulen !== null) buyutulen = null;
  }
</script>

<svelte:window onkeydown={tusla} />

<section class="sahne" data-buyuk={buyukKare !== null}>
  <div
    class="alan"
    data-alan="ana"
    class:galeri={!seritte}
    bind:clientWidth={alanEn}
    bind:clientHeight={alanBoy}
  >
    {#if duzen.ekranlar.length === 0 && duzen.kisiler.length === 0}
      <!-- Bos siyah alan bozukluk gibi okunur; sebebini yaz. -->
      <p class="bos">Kimsenin kamerası açık değil.</p>
    {:else if seritte}
      <div class="ekranlar" class:tek={gosterilenEkranlar.length === 1}>
        {#each gosterilenEkranlar as e (e.anahtar)}
          <VideoTile
            track={e.track}
            label={e.kendisi ? `${e.ad} — ekranın` : `${e.ad} — ekran`}
            userId={e.userId}
            mixer={e.kendisi ? null : voice.ekranMikseri}
            buyuk={buyutulen === e.anahtar}
            onBuyut={() => (buyutulen = buyutulen === e.anahtar ? null : e.anahtar)}
          />
        {/each}
      </div>
    {:else}
      <div class="izgara" style="--sutun: {olcu.sutun}">
        {#each duzen.kisiler as k (k.anahtar)}
          <div class="hucre"><StageTile kare={k} micMixer={voice.mikMikseri} /></div>
        {/each}
      </div>
    {/if}
  </div>

  {#if seritte && duzen.kisiler.length > 0 && buyukKare === null}
    <div class="serit" data-alan="serit">
      {#each duzen.kisiler as k (k.anahtar)}
        <div class="seritKare"><StageTile kare={k} micMixer={voice.mikMikseri} /></div>
      {/each}
    </div>
  {/if}

  <VoiceControls
    {mod}
    {onToggleMute}
    {onToggleDeafen}
    {onToggleCamera}
    {onToggleScreen}
    onToggleGorunum={gorunumDegistir}
    {onSesAyari}
    {onLeave}
  />
</section>

<style>
  .sahne { flex: 1; display: flex; flex-direction: column; min-height: 0; }
  /*
    Tarayici ici tam ekran: sahne uygulamanin ustune yayilir, isletim
    sisteminin tam ekrani DEGIL (Napol boyle istedi). Kontrol cubugu
    goruntunun altinda kalmaya devam eder.
  */
  .sahne[data-buyuk="true"] {
    position: fixed; inset: 0; z-index: 60;
    background: var(--zemin-0);
  }

  .alan {
    flex: 1; min-height: 0; display: flex; flex-direction: column;
    padding: 14px 16px;
  }
  /* Galeri KAYMAZ: kareler alana sigacak sekilde kucululur (Discord gibi). */
  .alan.galeri { overflow: hidden; }

  /* Ekranlar ana alanin TAMAMINI kaplar: yukseklik alandan gelir. */
  .ekranlar {
    flex: 1; min-height: 0;
    display: grid; gap: 10px;
    grid-template-columns: repeat(auto-fit, minmax(320px, 1fr));
    align-items: stretch;
  }
  .ekranlar.tek { grid-template-columns: 1fr; }

  /*
    Galeri: kareler sabit oranli, satirlar YUKARIDAN baslar. align-content
    olmadan satirlar esit boluniyor ve kareler arasinda gereksiz bosluk
    aciliyordu.
  */
  .izgara {
    flex: 1; min-height: 0;
    display: grid; gap: 10px;
    grid-template-columns: repeat(var(--sutun), minmax(0, 1fr));
    grid-auto-rows: minmax(0, 1fr);
  }
  /* Kare hucrenin ORTASINDA ve oranini koruyarak buyur. */
  .hucre { display: grid; place-items: center; min-width: 0; min-height: 0; }
  .hucre :global(figure) { max-width: 100%; max-height: 100%; width: 100%; }

  /* Serit: sabit yukseklikte, tasarsa yatay kayan kisi kareleri. */
  .serit {
    display: flex; gap: 8px;
    padding: 0 16px 10px;
    overflow-x: auto; overflow-y: hidden;
    scrollbar-width: thin;
  }
  .seritKare { flex: 0 0 auto; width: 168px; }

  .bos {
    flex: 1; display: grid; place-items: center;
    margin: 0; color: var(--metin-3); font-size: 13px;
  }
</style>
