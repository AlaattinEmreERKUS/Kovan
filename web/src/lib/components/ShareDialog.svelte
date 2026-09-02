<script lang="ts">
  import { systemAudioAvailable, type ShareOptions, type Surface } from "$lib/rtc/share";

  let { open, onConfirm, onCancel }: {
    open: boolean;
    onConfirm: (o: ShareOptions) => void;
    onCancel: () => void;
  } = $props();

  let surface = $state<Surface>("monitor");
  let systemAudio = $state(true);

  const sesAcilabilir = $derived(systemAudioAvailable(surface));
</script>

{#if open}
  <div
    class="perde"
    role="dialog"
    aria-modal="true"
    aria-label="Ekran paylaşımı ayarları"
    tabindex="-1"
    onkeydown={(e) => e.key === "Escape" && onCancel()}
  >
    <div class="kutu">
      <h2>Ne paylaşılsın?</h2>

      <fieldset>
        <legend>Yüzey</legend>
        <label>
          <input type="radio" bind:group={surface} value="monitor" />
          Tüm ekran
        </label>
        <label>
          <input type="radio" bind:group={surface} value="window" />
          Uygulama penceresi
        </label>
      </fieldset>

      <label class="anahtar" class:pasif={!sesAcilabilir}>
        <input type="checkbox" bind:checked={systemAudio} disabled={!sesAcilabilir} />
        Sistem sesini de paylaş
      </label>
      {#if !sesAcilabilir}
        <p class="not">Windows'ta pencere paylaşımında sistem sesi alınamaz.</p>
      {/if}

      <p class="not">
        Devam edince Windows'un kendi seçicisi açılır; paylaşılacak ekranı orada seçersiniz.
      </p>

      <div class="dugmeler">
        <button onclick={onCancel}>Vazgeç</button>
        <button
          class="birincil"
          onclick={() => onConfirm({ surface, systemAudio: systemAudio && sesAcilabilir })}
        >Devam</button>
      </div>
    </div>
  </div>
{/if}

<style>
  .perde {
    position: fixed; inset: 0; display: grid; place-items: center;
    background: rgba(0, 0, 0, 0.6); z-index: 10;
  }
  .kutu {
    width: 340px; padding: 18px; border-radius: var(--radius);
    background: var(--zemin-1); border: 1px solid var(--cizgi);
  }
  h2 { margin: 0 0 14px; font-size: 15px; }
  fieldset { border: none; margin: 0 0 12px; padding: 0; display: grid; gap: 6px; }
  legend { padding: 0; font-size: 11px; letter-spacing: 0.06em; text-transform: uppercase; color: var(--metin-3); }
  label { display: flex; align-items: center; gap: 8px; font-size: 13px; }
  .anahtar.pasif { color: var(--metin-3); }
  .not { margin: 8px 0 0; font-size: 11px; color: var(--metin-3); line-height: 1.4; }
  .dugmeler { display: flex; gap: 8px; justify-content: flex-end; margin-top: 16px; }
  .dugmeler button { padding: 6px 14px; color: var(--metin-2); }
  .dugmeler button:hover { background: var(--zemin-2); color: var(--metin-1); }
  .birincil { background: var(--bal-zemin); color: var(--bal-sicak); }
</style>
