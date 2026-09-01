<nav>
  <div class="baslik">Kovan</div>
  <ul>
    <li><button class="kanal aktif"><span aria-hidden="true">#</span> genel</button></li>
    <li><button class="kanal" disabled><span aria-hidden="true">♪</span> sohbet</button></li>
  </ul>
  <p class="not">Ses kanalı sonraki aşamada açılacak.</p>
</nav>

<style>
  nav { width: 190px; border-right: 1px solid var(--cizgi); padding: 14px 10px; background: var(--zemin-1); }
  .baslik { font-weight: 600; letter-spacing: 0.02em; padding: 0 6px 12px; }
  ul { list-style: none; margin: 0; padding: 0; display: grid; gap: 2px; }
  .kanal {
    width: 100%; text-align: left; padding: 6px 8px;
    color: var(--metin-2); transition: background var(--gecis), color var(--gecis);
  }
  .kanal:hover:not(:disabled) { background: var(--zemin-2); color: var(--metin-1); }
  .kanal.aktif { background: var(--bal-zemin); color: var(--bal-sicak); }
  .kanal:disabled { color: var(--metin-3); cursor: default; }
  .not { margin: 14px 6px 0; font-size: 11px; color: var(--metin-3); line-height: 1.4; }
</style>
