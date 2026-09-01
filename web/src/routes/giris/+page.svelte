<script lang="ts">
  import { goto } from "$app/navigation";
  import { PUBLIC_API_URL } from "$env/static/public";

  let mod = $state<"giris" | "kayit">("giris");
  let username = $state("");
  let displayName = $state("");
  let password = $state("");
  let code = $state("");
  let hata = $state("");
  let bekliyor = $state(false);

  async function gonder(e: SubmitEvent) {
    e.preventDefault();
    hata = ""; bekliyor = true;
    try {
      const yol = mod === "giris" ? "/api/login" : "/api/register";
      const govde = mod === "giris"
        ? { username, password }
        : { code, username, displayName, password };

      const res = await fetch(`${PUBLIC_API_URL}${yol}`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(govde),
      });
      const veri = await res.json();
      if (!res.ok) { hata = veri.message ?? "Bir şeyler ters gitti."; return; }
      localStorage.setItem("kovan_token", veri.token);
      await goto("/");
    } catch {
      hata = "Sunucuya ulaşılamadı.";
    } finally {
      bekliyor = false;
    }
  }
</script>

<div class="orta">
  <form onsubmit={gonder}>
    <h1>Kovan</h1>
    {#if mod === "kayit"}
      <input bind:value={code} placeholder="Davet kodu" required />
      <input bind:value={displayName} placeholder="Görünen ad" required />
    {/if}
    <input bind:value={username} placeholder="Kullanıcı adı" autocomplete="username" required />
    <input bind:value={password} type="password" placeholder="Parola" autocomplete="current-password" required />
    {#if hata}<p class="hata" role="alert">{hata}</p>{/if}
    <button type="submit" disabled={bekliyor}>
      {bekliyor ? "…" : mod === "giris" ? "Gir" : "Kayıt ol"}
    </button>
    <button type="button" class="gecis" onclick={() => { mod = mod === "giris" ? "kayit" : "giris"; hata = ""; }}>
      {mod === "giris" ? "Davet kodun mu var? Kayıt ol" : "Hesabın var mı? Giriş yap"}
    </button>
  </form>
</div>

<style>
  .orta { display: grid; place-items: center; height: 100vh; }
  form {
    display: grid; gap: 10px; width: 300px; padding: 26px;
    background: var(--zemin-1); border: 1px solid var(--cizgi); border-radius: var(--radius);
  }
  h1 { margin: 0 0 6px; font-size: 19px; letter-spacing: 0.02em; }
  input {
    padding: 9px 11px; background: var(--zemin-2); color: var(--metin-1);
    border: 1px solid var(--cizgi); border-radius: var(--radius); font: inherit;
  }
  input:focus { outline: none; border-color: var(--bal); }
  button[type="submit"] { padding: 9px; background: var(--bal); color: #14110C; font-weight: 600; }
  button[type="submit"]:disabled { opacity: 0.6; }
  .gecis { font-size: 12px; color: var(--metin-3); }
  .gecis:hover { color: var(--metin-2); }
  .hata { margin: 0; font-size: 12px; color: var(--tehlike); }
</style>
