<script lang="ts">
  import { onMount, onDestroy } from "svelte";
  import { goto } from "$app/navigation";
  import { PUBLIC_API_URL, PUBLIC_WS_URL } from "$env/static/public";
  import { Connection } from "$lib/connection.svelte";
  import { store } from "$lib/store.svelte";
  import { voice } from "$lib/voice.svelte";
  import { VoiceSession } from "$lib/rtc/session";
  import { isTauri, kopru, kisayolDinle, kisayolUygula } from "$lib/masaustu";
  import { kisayollariOku, type KayitSonucu } from "$lib/kisayollar";
  import ChannelRail from "$lib/components/ChannelRail.svelte";
  import MessageList from "$lib/components/MessageList.svelte";
  import Composer from "$lib/components/Composer.svelte";
  import MemberList from "$lib/components/MemberList.svelte";
  import RemoteAudio from "$lib/components/RemoteAudio.svelte";
  import VoiceStage from "$lib/components/VoiceStage.svelte";
  import ShareBanner from "$lib/components/ShareBanner.svelte";
  import IndirSeridi from "$lib/components/IndirSeridi.svelte";
  import Icon from "$lib/components/Icon.svelte";

  // $state sart: oturumu kuran efekt bunun atanmasini beklemek zorunda.
  let baglanti = $state<Connection | null>(null);
  // $state sart: oturum atandiginda VoiceStage'in mixer prop'u guncellenmeli.
  let oturum = $state<VoiceSession | null>(null);
  let aktifSekme = $state<"metin" | "ses">("metin");
  // Rust hangi kisayolu kaydedebildi. Bos dizi = masaustu degiliz ya da
  // kayit hic denenmedi; ayarlar paneli yalniz `kayitli:false` olani uyarir.
  let kisayolSonuclari = $state<KayitSonucu[]>([]);

  async function katil() {
    await oturum?.join();
    // join basarisiz olduysa (mikrofon izni yok) sahneye gecme.
    if (voice.joined) aktifSekme = "ses";
  }

  function ayril() {
    oturum?.leave();
    aktifSekme = "metin";
  }

  // Kopma ses sekmesinde yakaladiysa geri baglanmada oraya donulur.
  let sesSekmesineDon = $state(false);

  // Baglanti koparsa resetVoice joined'i dusurur; sahne kilitli kalmamali.
  $effect(() => {
    if (voice.joined) {
      if (sesSekmesineDon) {
        sesSekmesineDon = false;
        aktifSekme = "ses";
      }
      return;
    }
    if (aktifSekme === "ses") {
      sesSekmesineDon = true;
      aktifSekme = "metin";
    }
  });

  // Yuzey ve sistem sesi secimi tarayicinin kendi secicisinde yapiliyor;
  // araya kendi diyalogumuzu koymuyoruz (share.ts).
  async function ekranDugmesi() {
    if (voice.screen) oturum?.stopScreen();
    else await oturum?.startScreen();
  }

  onMount(() => {
    const token = localStorage.getItem("kovan_token");
    if (token === null) { void goto("/giris"); return; }
    baglanti = new Connection(PUBLIC_WS_URL, token);
  });

  // selfId hello gelene kadar bilinmiyor; oturum store.me dolunca kurulur.
  $effect(() => {
    // Bagimliliklar KOSULDAN ONCE okunur. "if (!baglanti || !store.me)"
    // yazilirsa baglanti null oldugu an kisa devre olur, store.me hic okunmaz
    // ve efekt hicbir bagimlilik kaydetmeden oler; hello gelse bile bir daha
    // calismaz. Bugun onMount efektlerden once kostugu icin bu tetiklenmiyor,
    // ama sirayi bozan tek bir duzenleme "katil dugmesi hicbir sey yapmiyor"
    // demek olurdu -- sessiz ariza, gorunur hata yok.
    const conn = baglanti;
    const me = store.me;
    if (!conn || !me || oturum) return;
    oturum = new VoiceSession({
      conn,
      selfId: me.id,
      apiUrl: PUBLIC_API_URL,
      token: localStorage.getItem("kovan_token") ?? "",
    });
    if (import.meta.env.DEV) {
      // Playwright kancasi: yalnizca dev build'de tanimlanir.
      (window as unknown as { __kovan?: unknown }).__kovan = { oturum, voice };
    }

    // Masaustunde global kisayollar. Tarayicida bu blok hic calismaz.
    if (isTauri()) {
      const k = kopru();
      if (k) {
        void k
          .invoke<KayitSonucu[]>("kisayollari_ayarla", { kisayollar: kisayollariOku() })
          .then((s) => { kisayolSonuclari = s; })
          // Kayit istegi patlarsa uygulama calismaya devam eder; kisayol
          // olmadan mikrofon dugmesi hala var.
          .catch(() => { kisayolSonuclari = []; });
        void kisayolDinle(k, (o) =>
          kisayolUygula(o, oturum!, {
            joined: voice.joined, muted: voice.muted, deafened: voice.deafened,
          }));
        // Tepsi etiketi voice.muted ile senkron kalsin (R11): kisayolla ya da
        // arayuzden cevrildiginde menude yazan sey de degissin.
        $effect(() => {
          void k.invoke("mikrofon_etiketi", { muted: voice.muted }).catch(() => {});
        });
      }
    }
    // Uretimde de duran TESHIS ciktisi. Canlida gorulen ama yerelde
    // uretilemeyen hatalarin (kamera kayboluyor, ekran gorunmuyor) tek
    // kaniti bu: konsola `kovanDurum()` yazip ciktisi paylasiliyor.
    // Yalnizca OKUR; token ya da parola icermez.
    (window as unknown as { kovanDurum?: unknown }).kovanDurum = () => ({
      surum: __KOVAN_SURUM__,
      api: PUBLIC_API_URL,
      sekme: aktifSekme,
      joined: voice.joined,
      bayraklarim: {
        muted: voice.muted, deafened: voice.deafened,
        camera: voice.camera, screen: voice.screen, screenAudio: voice.screenAudio,
      },
      yerelTrackler: {
        cam: izDurumu(voice.local.cam),
        screenVideo: izDurumu(voice.local.screenVideo),
      },
      // Tercih ile ETKIN cihaz AYRI raporlanir: 2026-09-05'te kulaklik geri
      // takilinca ses geri donuyor ama menu "Varsayilan"da kaliyordu ve
      // buradan hangisinin yalan soyledigi gorulemiyordu.
      cihazlar: {
        girisTercihi: voice.girisTercihi,
        cikisTercihi: voice.cikisTercihi,
        etkinGiris: voice.etkinGiris,
        etkinCikis: voice.cikisCihazi,
        mikYok: voice.mikYok,
        calanMikrofon: oturum?.mikAyari()?.deviceId ?? null,
      },
      sunucununGorduguUyeler: voice.members,
      uzakTrackler: [...voice.remote.entries()].map(([id, t]) => ({
        userId: id,
        mic: izDurumu(t.mic), cam: izDurumu(t.cam),
        screenVideo: izDurumu(t.screenVideo), screenAudio: izDurumu(t.screenAudio),
      })),
      baglantiDurumu: [...voice.connection.entries()],
      mikserler: {
        ekran: voice.ekranMikseri !== null,
        mikrofon: voice.mikMikseri !== null,
        yedekAudioElementi: document.querySelectorAll('audio[data-kovan="yedek"]').length,
        mikserPompasi: document.querySelectorAll('audio[data-kovan="mikser"]').length,
      },
      cizilen: {
        kisiKaresi: document.querySelectorAll('[data-kare="kisi"]').length,
        ekranKaresi: document.querySelectorAll('[data-kare="ekran"]').length,
        video: document.querySelectorAll('[data-kare] video').length,
      },
      gorunum: localStorage.getItem("kovan_gorunum"),
      sesAyarlari: voice.sesAyarlari,
      girisSeviyesi: Number(voice.girisSeviyesi.toFixed(4)),
      // Tarayici filtreleri GERCEKTEN uygulandi mi: istedigimiz kisit ile
      // cihazin verdigi ayar farkli olabilir.
      mikrofonAyari: oturum?.mikAyari() ?? null,
    });
  });

  onDestroy(() => { oturum?.destroy(); baglanti?.close(); });

  /** Teshis ciktisi icin tek satirlik ozet; track yoksa null. */
  function izDurumu(t: MediaStreamTrack | null) {
    return t === null ? null : { readyState: t.readyState, muted: t.muted, enabled: t.enabled };
  }

  function gonder(metin: string) {
    baglanti?.send({ t: "msg.send", content: metin, localId: crypto.randomUUID() });
  }
  function tepki(messageId: number, emoji: string) {
    baglanti?.send({ t: "reaction.toggle", messageId, emoji });
  }
</script>

<div class="kabuk">
  <ChannelRail
    {aktifSekme}
    onMetinSekmesi={() => (aktifSekme = "metin")}
    onJoin={() => void katil()}
    onSahneyeDon={() => (aktifSekme = "ses")}
    onLeave={ayril}
    onToggleMute={() => oturum?.setMuted(!voice.muted)}
    onToggleDeafen={() => oturum?.setDeafened(!voice.deafened)}
    onToggleCamera={() => void oturum?.setCamera(!voice.camera)}
    onToggleScreen={() => void ekranDugmesi()}
  />
  <main>
    <!--
      Serit main'in icinde: kabuk 100vh'lik bir satir izgarasi, ustune bir
      seyler eklemek gecen oturumdaki tasma hatasini geri getirirdi.
    -->
    <IndirSeridi />

    <header class="ust">
      {#if aktifSekme === "ses"}
        <Icon ad="kanal-ses" boyut={15} /> sohbet
      {:else}
        <Icon ad="kanal-metin" boyut={15} /> genel
      {/if}
      {#if store.durum !== "acik"}
        <span class="durum">{store.durum === "baglaniyor" ? "bağlanıyor…" : "bağlantı koptu"}</span>
      {/if}
    </header>

    <!--
      Serit HER IKI sekmede de gorunur: ekranini paylasirken sohbete
      donmen paylasimin durdurma dugmesini kaybetmeni gerektirmez.
      e2e/screen.spec.ts bunu sahnedeyken getByRole("status") ile ariyor.
    -->
    <ShareBanner
      onStop={() => oturum?.stopScreen()}
      onDegistir={() => oturum?.degistirEkran()}
    />

    {#if aktifSekme === "ses" && voice.joined && store.me}
      <VoiceStage
        selfId={store.me.id}
        {kisayolSonuclari}
        onToggleMute={() => oturum?.setMuted(!voice.muted)}
        onToggleDeafen={() => oturum?.setDeafened(!voice.deafened)}
        onToggleCamera={() => void oturum?.setCamera(!voice.camera)}
        onToggleScreen={() => void ekranDugmesi()}
        onSesAyari={(a) => void oturum?.setSesAyarlari(a)}
        onGirisCihazi={(id) => void oturum?.setGirisCihazi(id)}
        onCikisCihazi={(id) => void oturum?.setCikisCihazi(id)}
        onBip={() => oturum?.testci()?.bip()}
        onGeriDinlemeBasla={() => {
          const t = oturum?.gidenMikPublic();
          if (t) oturum?.testci()?.geriDinlemeBasla(t);
        }}
        onGeriDinlemeBitir={() => oturum?.testci()?.geriDinlemeBitir()}
        onLeave={ayril}
      />
    {:else}
      <MessageList onToggleReaction={tepki} />
      <Composer onSend={gonder} onTyping={() => baglanti?.typing()} />
    {/if}
  </main>
  <MemberList />
  <RemoteAudio />
</div>

<style>
  /* Sutunlarin HER BIRI kendi icinde kayar; govde HIC kaymaz. overflow
     hidden olmazsa uzun uye listesi 100vh'yi tasirir, sayfa asagi kayar ve
     kanal rayi ile sohbet ekrandan cikar -- "asagidaki uyeye bakayim"
     derken sohbeti kaybediyordun. */
  .kabuk { display: flex; height: 100dvh; overflow: hidden; }
  /* min-height: 0 SART. Flex cocugunun varsayilan alt siniri icerigi kadardir;
     onsuz main mesaj sayisiyla birlikte buyur ve .liste'nin overflow-y: auto
     kurali hicbir sey yapmaz. */
  main { flex: 1; display: flex; flex-direction: column; min-width: 0; min-height: 0; }
  .ust {
    display: flex; align-items: center; gap: 8px;
    padding: 12px 16px; border-bottom: 1px solid var(--cizgi); font-weight: 600;
  }
  .durum { margin-left: auto; font-size: 12px; font-weight: 400; color: var(--tehlike); }
</style>
