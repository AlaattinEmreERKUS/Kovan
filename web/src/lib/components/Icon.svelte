<script lang="ts">
  import { IKONLAR, type IkonAdi } from "$lib/icons";

  let { ad, boyut = 20 }: { ad: IkonAdi; boyut?: number } = $props();
</script>

<!--
  {@html} burada guvenli: icerik sabit bir modulden geliyor, kullanici
  girdisi degil. Erisilebilirlik etiketi cagiran dugmede durur.
-->
<svg
  width={boyut}
  height={boyut}
  viewBox="0 0 24 24"
  fill="none"
  aria-hidden="true"
  focusable="false"
>{@html IKONLAR[ad]}</svg>

<style>
  svg { display: block; flex: none; }
</style>
