<script lang="ts">
  import { isTauri } from "$lib/masaustu";
  import { INDIRME_ADRESI, indirmeGorunsun, indirmeKapat } from "$lib/indir";
  import Icon from "./Icon.svelte";

  /**
   * Karar bir kez, bilesen kurulurken veriliyor. $derived olsaydi kapatma
   * localStorage'a yazip tekrar okumak zorunda kalirdi; burada tek bayrak
   * yetiyor.
   */
  let gorunur = $state(indirmeGorunsun(isTauri()));

  function kapat() {
    indirmeKapat();
    gorunur = false;
  }
</script>

{#if gorunur}
  <div class="serit">
    <Icon ad="ekran" boyut={13} />
    <span>Kovan'ı masaüstüne kur: bas-konuş ve kısayollar oyundayken de çalışır.</span>
    <a href={INDIRME_ADRESI} download>İndir</a>
    <button class="kapat" aria-label="İndirme şeridini kapat" onclick={kapat}>×</button>
  </div>
{/if}

<style>
  /*
    ShareBanner ile ayni yerde durabilir; bu yuzden role="status" YOK.
    Ikisi de status olsaydi e2e/screen.spec.ts'nin getByRole("status")
    aramasi iki oge bulur, paylasim seridi testi kirilirdi.
  */
  .serit {
    display: flex; align-items: center; gap: 8px;
    padding: 6px 16px; font-size: 12px;
    background: var(--bal-zemin); color: var(--bal-sicak);
    border-bottom: 1px solid var(--cizgi);
  }
  a {
    margin-left: auto; padding: 2px 10px; border-radius: 4px;
    background: var(--bal); color: var(--zemin-0);
    font-weight: 600; text-decoration: none;
  }
  a:hover { filter: brightness(1.08); }
  .kapat {
    border: none; background: none; color: var(--bal-sicak);
    font-size: 16px; line-height: 1; cursor: pointer; padding: 0 2px;
  }
  .kapat:hover { color: var(--metin-1); }
</style>
