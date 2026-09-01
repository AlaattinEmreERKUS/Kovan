<script lang="ts">
  import { store } from "$lib/store.svelte";
  const sirali = $derived(
    [...store.members].sort((a, b) => {
      const fark = Number(store.online.has(b.id)) - Number(store.online.has(a.id));
      return fark !== 0 ? fark : a.displayName.localeCompare(b.displayName, "tr");
    })
  );
</script>

<aside>
  <h2>Üyeler — {store.online.size}/{store.members.length}</h2>
  <ul>
    {#each sirali as u (u.id)}
      <li class:cevrimdisi={!store.online.has(u.id)}>
        <span class="nokta" class:acik={store.online.has(u.id)}></span>{u.displayName}
      </li>
    {/each}
  </ul>
</aside>

<style>
  aside { width: 200px; border-left: 1px solid var(--cizgi); padding: 14px 12px; background: var(--zemin-1); }
  h2 { margin: 0 0 10px; font-size: 11px; letter-spacing: 0.06em; text-transform: uppercase; color: var(--metin-3); font-weight: 600; }
  ul { list-style: none; margin: 0; padding: 0; display: grid; gap: 3px; }
  li { display: flex; align-items: center; gap: 8px; padding: 4px 6px; border-radius: var(--radius); }
  li.cevrimdisi { color: var(--metin-3); }
  .nokta { width: 7px; height: 7px; border-radius: 50%; background: var(--metin-3); }
  .nokta.acik { background: var(--online); }
</style>
