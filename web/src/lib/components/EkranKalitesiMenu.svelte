<script lang="ts">
  import { voice } from "$lib/voice.svelte";
  import {
    COZUNURLUKLER, FPSLER, type Cozunurluk, type EkranKalitesi, type Fps,
  } from "$lib/ekran-kalitesi";

  let { onSec }: { onSec: (k: EkranKalitesi) => void } = $props();

  // Store'dan okunur, VoiceSession'dan degil: secim sonrasi menu repaint
  // olmali (tekrar eden tuzak 1, voice.svelte.ts).
  const k = $derived(voice.ekranKalitesi);

  const ETIKET: Record<Cozunurluk, string> = { "720p": "720p", "1080p": "1080p", kaynak: "Kaynak" };

  function cozunurlukSec(c: Cozunurluk) {
    if (c !== k.cozunurluk) onSec({ cozunurluk: c, fps: k.fps });
  }
  function fpsSec(f: Fps) {
    if (f !== k.fps) onSec({ cozunurluk: k.cozunurluk, fps: f });
  }
</script>

<!--
  Etiket "Ekran paylas" ile BASLAMAMALI: getByLabel alt dize eslestirir ve
  e2e'deki "Ekran paylaş" dugmesi aramasi iki ogeye cozulurdu.
-->
<div class="menu" role="dialog" aria-label="Ekran kalitesi seçenekleri">
  <div class="grup">
    <span class="ad" id="ekran-cozunurluk">Çözünürlük</span>
    <div class="secenekler" role="radiogroup" aria-labelledby="ekran-cozunurluk">
      {#each COZUNURLUKLER as c (c)}
        <button
          type="button" role="radio" aria-checked={k.cozunurluk === c}
          class:secili={k.cozunurluk === c}
          onclick={() => cozunurlukSec(c)}
        >{ETIKET[c]}</button>
      {/each}
    </div>
  </div>

  <div class="grup">
    <span class="ad" id="ekran-fps">Kare hızı</span>
    <div class="secenekler" role="radiogroup" aria-labelledby="ekran-fps">
      {#each FPSLER as f (f)}
        <button
          type="button" role="radio" aria-checked={k.fps === f}
          class:secili={k.fps === f}
          onclick={() => fpsSec(f)}
        >{f} fps</button>
      {/each}
    </div>
  </div>

  <p class="not">
    {k.fps === 60 ? "Akıcılık öncelikli: bağlantı yetmezse çözünürlük düşer."
                  : "Netlik öncelikli: bağlantı yetmezse kare hızı düşer."}
  </p>
</div>

<style>
  /* Ekran dugmesi medya grubunun ortasinda; menu ona ortalanir. */
  .menu {
    position: absolute; left: 50%; bottom: calc(100% + 8px); z-index: 20;
    transform: translateX(-50%);
    width: 232px; display: flex; flex-direction: column; gap: 10px;
    padding: 12px; border-radius: var(--radius);
    background: var(--zemin-2); border: 1px solid var(--cizgi);
    box-shadow: 0 12px 32px rgba(0, 0, 0, 0.45);
    font-size: 12px; color: var(--metin-1); text-align: left;
  }
  .grup { display: flex; flex-direction: column; gap: 6px; }
  .ad { color: var(--metin-2); font-weight: 600; }
  .secenekler { display: flex; gap: 4px; }
  .secenekler button {
    flex: 1; padding: 5px 0; font-size: 12px; cursor: pointer;
    background: var(--zemin-0); color: var(--metin-2);
    border: 1px solid var(--cizgi); border-radius: 4px;
    transition: border-color var(--gecis), color var(--gecis);
  }
  .secenekler button:hover { border-color: var(--bal); color: var(--metin-1); }
  .secenekler button.secili {
    color: var(--bal-sicak); background: var(--bal-zemin); border-color: var(--bal);
  }
  .not { margin: 0; color: var(--metin-3); font-size: 11px; line-height: 1.4; }
</style>
