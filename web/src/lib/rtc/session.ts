import type { VoiceMember } from "@shared/protocol";
import type { Connection } from "../connection.svelte";
import { bosTracks, bosYerel, localFlags, voice } from "../voice.svelte";
import { LocalMedia } from "./media";
import { Mesh } from "./mesh";
import { Peer, type EkranOzeti, type SignalPayload, type TrackSlot } from "./peer";
import { SpeakingDetector } from "./speaking";
import { ekranMikseri, mikrofonMikseri, type RemoteAudioMixer } from "./gain";
import { MikrofonIsleyici } from "./mikrofon";
import { SesTestcisi } from "./ses-testi";
import { sesAyarlariOku, sesAyarlariYaz, type SesAyarlari } from "../ses-ayarlari";
import { cihazSecimiOku, cihazSecimiYaz, type CihazSecimi } from "../ses-cihazlari";
import { ekranKalitesiYaz, type EkranKalitesi } from "../ekran-kalitesi";
import {
  cihazlariListele, tarayiciCihazDeps, tarayiciCihazOlaylari, type CihazDeps,
} from "./cihazlar";
import { BildirimCalar, type Bildirimci } from "./bildirim-sesleri";
import { uyeFarki } from "./uye-farki";

export interface SessionOptions {
  conn: Connection;
  selfId: string;
  apiUrl: string;
  token: string;
  media?: LocalMedia;
  createPeerConnection?(cfg: RTCConfiguration): RTCPeerConnection;
  fetchImpl?: typeof fetch;
  /** Node testinde AudioContext yok; disaridan verilebilir. */
  createAudioContext?(): AudioContext | null;
  /** Node testinde navigator.mediaDevices yok; disaridan verilebilir. */
  cihazDeps?: CihazDeps;
  /** devicechange aboneligi. Testte sahtesi verilir. */
  cihazOlaylari?: {
    ekle(tip: string, f: () => void): void;
    kaldir(tip: string, f: () => void): void;
  };
  /** Katilma/ayrilma/susturma bildirim sesleri. Testte sahtesi verilir. */
  bildirim?: Bildirimci;
}

/**
 * TURN credential'i ne siklikta tazelenir. Sunucu TTL'i 3600 sn
 * (server/src/turn.ts); 45 dakika 15 dakikalik emniyet payi birakir.
 *
 * Tazelenmezse saatler suren bir oturumda credential oturumun ALTINDA olur:
 * o andan sonra restartIce() relay adayi toplayamaz ve simetrik NAT
 * arkasindaki kullanici geri baglanamaz. Ariza sessizdir, cunku STUN
 * adaylari toplanmaya devam eder.
 */
const ICE_TAZELEME = 45 * 60_000;

/** TURN alinamazsa bile kanal acilir; ev aglarinin cogunda STUN yeter. */
const YEDEK_ICE: RTCIceServer[] = [{ urls: "stun:stun.cloudflare.com:3478" }];

/**
 * Ses oturumunun tek sahibi. Component'ler WebRTC API'sine dokunmaz; yalnizca
 * bu sinifin metotlarini cagirir ve `voice` store'unu okur.
 */
export class VoiceSession {
  private mesh: Mesh | null = null;
  private media: LocalMedia;
  private ice: RTCIceServer[] = YEDEK_ICE;
  private audioCtx: AudioContext | null = null;
  private speaking: SpeakingDetector | null = null;
  /** Arayuz kaydiriciyi buradan okur; kisiye ozel, sunucuya gitmez. */
  mixer: RemoteAudioMixer | null = null;
  /** Kisi bazli mikrofon seviyesi; RemoteAudio yalnizca bu yokken calar. */
  micMixer: RemoteAudioMixer | null = null;
  /** Giden mikrofonun kapisi. Yoksa ham track gonderilir. */
  private mikIsleyici: MikrofonIsleyici | null = null;
  /** Panelin test araci. Oturumun context'ini odunc alir. */
  private sesTestcisi: SesTestcisi | null = null;
  /**
   * Kullanici ses kanalinda OLMAK ISTIYOR mu. `voice.joined` fiili durumdur ve
   * kopmada dusurulur; niyet kopmayi asar. Ikisini ayirmadan "ag koptu" ile
   * "kullanici cikti" ayirt edilemiyor ve geri baglanmada kimse kanala
   * donmuyordu.
   */
  private katilmaNiyeti = false;
  /** Kopma anindaki susturma durumu; geri katilimda geri yuklenir. */
  private niyetMuted = false;
  private niyetDeafened = false;
  /** TURN credential tazeleme dongusu. Yalnizca kanaldayken doner. */
  private iceZamanlayici: ReturnType<typeof setInterval> | null = null;
  /** Kullanicinin cihaz TERCIHI. Etkin cihaz bundan ayridir (voice.etkinGiris). */
  private cihazSecimi: CihazSecimi = cihazSecimiOku();
  private cihazDeps: CihazDeps;
  private cihazDegisti = (): void => { void this.cihazlariGozden(); };
  private bildirim: Bildirimci;
  /**
   * Bir onceki ses kanali uye listesi. `null` = henuz tohumlanmadi; kopma
   * sonrasi sunucu tam listeyi bastan gonderdigi icin bu ayrim olmadan
   * odadaki herkes "yeni girdi" sayilir ve bip yagmuru olur.
   */
  private oncekiUyeler: string[] | null = null;

  constructor(private o: SessionOptions) {
    this.media = o.media ?? new LocalMedia();
    this.cihazDeps = o.cihazDeps ?? tarayiciCihazDeps();
    this.bildirim = o.bildirim ?? new BildirimCalar({
      createAudioContext: o.createAudioContext ?? (() => new AudioContext()),
    });
    o.conn.onVoiceMembers = (members) => this.onMembers(members);
    o.conn.onSignal = (from, data) => this.mesh?.handleSignal(from, data as SignalPayload);
    o.conn.onDisconnect = () => this.kopus();
    o.conn.onReconnect = () => this.yenidenKatil();
  }

  async join(): Promise<void> {
    // Guard `voice.joined` DEGIL `mesh`: kopmada joined dusuyor ama mesh
    // ayakta kalabiliyordu; o durumda ikinci join eskisini kapatmadan
    // uzerine yeni bir mesh yaziyor ve tum PC'ler acik siziyordu.
    if (this.mesh) return;
    // `yenidenKatil` kopma sonrasi buraya geri geliyor ve niyet o zaman ZATEN
    // true. Ayrimi burada yakalamazsak her ag kesintisinde kullanici kendi
    // giris bipini yeniden duyar.
    const yenidenKatilim = this.katilmaNiyeti;
    // Kayitli tercih burada uygulanir. Yalniz setSesAyarlari'da uygulansaydi,
    // sesleri kapatmis kullanici ayara dokunana kadar onlari duymaya devam
    // ederdi.
    this.bildirim.setAcik(voice.sesAyarlari.bildirimSesleri);
    voice.error = null;

    // Mikrofon ARTIK on kosul DEGIL. Onceden burada donuluyordu ve mikrofonunu
    // kaybeden kullanici kanala hic giremiyor, dolayisiyla ayarlardan cihaz
    // secip kendini kurtaramiyordu: sayfa yenilemeden geri donus yoktu.
    // Mikrofonsuz da girilir, digerleri duyulur, cihaz sonradan devreye alinir.
    let mikVar = true;
    try {
      await this.media.startMic(this.cihazSecimi.giris);
    } catch {
      mikVar = false;
      voice.error = "Mikrofona erişilemedi. Ses ayarlarından cihaz seçebilirsin.";
    }
    voice.mikYok = !mikVar;
    voice.etkinGiris = mikVar ? this.cihazSecimi.giris : null;
    // Kalici kaynak localStorage; store yalniz aynasidir ve resetVoice onu
    // siler. Her katilimda yeniden yayilmazsa panel tercihi bos gorurdu.
    this.tercihiYayinla();

    this.ice = (await this.fetchIce()) ?? YEDEK_ICE;
    this.iceTazelemeBasla();
    this.audioCtx = (this.o.createAudioContext ?? (() => new AudioContext()))();
    if (this.audioCtx) {
      // AudioContext tarayici politikasi geregi "suspended" baslayabilir.
      // Devam ettirilmezse AnalyserNode sifir doner (konusma gostergesi olur)
      // ve GainNode zincirinden ses cikmaz (ekran sesi duyulmaz).
      void this.audioCtx.resume().catch(() => {});
      // Kayitli cikis HEMEN uygulanir; yoksa her katilimda ses varsayilan
      // hoparlore duserdi.
      void this.cikisiUygula(this.cihazSecimi.cikis);
      this.speaking = new SpeakingDetector({
        ctx: this.audioCtx,
        onChange: (userId, konusuyor) => {
          if (konusuyor) voice.speaking.add(userId);
          else voice.speaking.delete(userId);
        },
      });
      // Kendi konusma gostergen KAPIDAN gelir: kapi kapaliyken karsi taraf
      // seni duymuyor, gostergenin yaniyor olmasi yanlis bilgi olurdu.
      if (this.media.mic) {
        this.mikIsleyici = new MikrofonIsleyici({
          ctx: this.audioCtx,
          track: this.media.mic,
          esik: voice.sesAyarlari.esik,
          onSeviye: this.seviyeGeldi,
        });
        this.mikIsleyici.setMod(voice.sesAyarlari.girisModu);
      }
      this.sesTestcisi = new SesTestcisi(this.audioCtx);
      this.mixer = ekranMikseri(this.audioCtx);
      this.mixer.setDeafened(voice.deafened);
      this.micMixer = mikrofonMikseri(this.audioCtx);
      this.micMixer.setDeafened(voice.deafened);
      // Bilesenler mikserleri store'dan okur; alan atamasi tepkisel degil.
      voice.ekranMikseri = this.mixer;
      voice.mikMikseri = this.micMixer;
    }

    this.mesh = new Mesh({
      selfId: this.o.selfId,
      createPeer: (userId, polite) => this.createPeer(userId, polite),
      onPeerGone: (userId) => {
        voice.remote.delete(userId);
        voice.speaking.delete(userId);
        this.speaking?.unwatch(userId);
        this.mixer?.detach(userId);
        this.micMixer?.detach(userId);
        voice.connection.delete(userId);
      },
    });

    (this.o.cihazOlaylari ?? tarayiciCihazOlaylari()).ekle("devicechange", this.cihazDegisti);
    if (this.media.mic) this.mikBittiDinle(this.media.mic);

    voice.joined = true;
    this.katilmaNiyeti = true;
    this.o.conn.send({ t: "voice.join" });
    // Sunucu yayini gelmeden once bilinen liste uygulanir: hello ile gelen
    // uyeler varsa baglanti hemen kurulmaya baslar.
    // Fark alici burada SESSIZCE tohumlanir. Kopma sonrasi geri katilimda da
    // buradan gecilir; tohumlanmazsa ilk yayin odadaki herkesi yeni girmis
    // sayar.
    this.oncekiUyeler = voice.members.map((m) => m.userId);
    this.mesh.setMembers(this.oncekiUyeler);
    this.media.setMuted(voice.muted);
    if (!yenidenKatilim) this.bildirim.cal("kanala-girdim");
  }

  leave(): void {
    if (!this.mesh) return;
    this.katilmaNiyeti = false;
    this.o.conn.send({ t: "voice.leave" });
    this.temizle();
    this.bildirim.cal("kanaldan-ciktim");
  }

  /**
   * Sinyal kanali koptu. Mesh HEMEN birakilir; sunucuya paket gitmez (socket
   * olu) ve katilma niyeti korunur.
   *
   * Baglantilari askida tutmayi denemistik: ses P2P aktigi icin kisa bir
   * kopmanin konusmayi kesmemesi gerekiyordu. Ama sunucu kopan uyeyi
   * voice.members'tan ANINDA dusuruyor, yani karsi taraf kendi peer'ini zaten
   * hemen kapatiyor ve medya duruyor. Tutmak ses kazandirmiyor, yalnizca
   * asimetri uretiyordu: geri donen taraf eski peer'ini koruyup yenisini
   * kurmuyor, karsi taraf ise yeni bir peer aciyordu. Yeni peer polite tarafa
   * duserse offer HIC uretilmez (onnegotiationneeded'i tetikleyen bir sey
   * yok) ve ses ancak ICE "failed"a dusunce ~30 sn sonra geri gelir.
   *
   * Iki taraf da bastan kurunca politeness sirasi hic devreye girmez.
   *
   * `false` = store'u Connection temizlesin.
   */
  private kopus(): boolean {
    if (!this.mesh) return false;
    this.niyetMuted = voice.muted;
    this.niyetDeafened = voice.deafened;
    this.temizle();
    return false;
  }

  /**
   * Socket geri geldi. Kopmada mesh birakildigi icin bastan katilinir; kopma
   * anindaki susturma durumu geri yuklenir.
   */
  private yenidenKatil(): void {
    if (!this.katilmaNiyeti) return;
    if (this.mesh) return;   // kopus yok, normal acilis

    void this.join().then(() => {
      if (!voice.joined) return;
      // Sessiz: bu onarim, kullanici eylemi degil.
      if (this.niyetDeafened) this.setDeafened(true, true);
      else if (this.niyetMuted) this.setMuted(true, true);
    });
  }

  /**
   * Credential omru dolmadan yenisini alir ve ACIK baglantilara uygular.
   * Basarisiz alim eskisini KORUR: gecici bir aglama yuzunden TURN'u
   * dusurup herkesi STUN'a mahkum etmek, tazelememekten daha kotudur.
   */
  private iceTazelemeBasla(): void {
    if (this.iceZamanlayici) return;
    this.iceZamanlayici = setInterval(() => {
      void this.fetchIce().then((yeni) => {
        if (!yeni) return;
        this.ice = yeni;
        this.mesh?.setIceServers(yeni);
      });
    }, ICE_TAZELEME);
  }

  private temizle(): void {
    (this.o.cihazOlaylari ?? tarayiciCihazOlaylari()).kaldir("devicechange", this.cihazDegisti);
    if (this.iceZamanlayici) {
      clearInterval(this.iceZamanlayici);
      this.iceZamanlayici = null;
    }
    this.mesh?.close();
    this.mesh = null;
    this.speaking?.stop();
    this.speaking = null;
    this.mikIsleyici?.close();
    this.mikIsleyici = null;
    voice.girisSeviyesi = 0;
    this.sesTestcisi?.kapat();
    this.sesTestcisi = null;
    this.mixer?.close();
    this.mixer = null;
    this.micMixer?.close();
    this.micMixer = null;
    voice.ekranMikseri = null;
    voice.mikMikseri = null;
    void this.audioCtx?.close();
    this.audioCtx = null;
    this.media.stopAll();
    voice.joined = false;
    voice.muted = false;
    voice.deafened = false;
    voice.camera = false;
    voice.screen = false;
    voice.screenAudio = false;
    voice.remote.clear();
    voice.local = bosYerel();
    voice.speaking.clear();
    voice.connection.clear();
  }

  /** Teshis: cihazin GERCEKTEN uyguladigi ses ayarlari. */
  mikAyari(): MediaTrackSettings | null {
    return this.media.mic?.getSettings() ?? null;
  }

  /** Kapidan gecmis track varsa o gider; yoksa ham mikrofon. */
  private gidenMik(): MediaStreamTrack | null {
    return this.mikIsleyici?.cikis ?? this.media.mic;
  }

  testci(): SesTestcisi | null {
    return this.sesTestcisi;
  }

  /** Panelin geri dinlemede calacagi track: kapidan GECMIS olan. */
  gidenMikPublic(): MediaStreamTrack | null {
    return this.gidenMik();
  }

  /**
   * Kapinin karari. Kendi gostergen kapidan gelir: kapi kapaliyken karsi
   * taraf seni duymuyor, gostergenin yaniyor olmasi yanlis bilgi olurdu.
   */
  private seviyeGeldi = (seviye: number, acik: boolean): void => {
    voice.girisSeviyesi = seviye;
    if (acik && !voice.muted) voice.speaking.add(this.o.selfId);
    else voice.speaking.delete(this.o.selfId);
  };

  /**
   * Tercihi store'a aynalar. Arayuz oradan okur, buradaki metotlardan DEGIL:
   * metot cagrisi tepkisel degil, Svelte prop'un degismedigini gorup acilir
   * menuyu repaint etmiyordu. Cihaz cikip geri takilinca ses geri geliyor ama
   * menu "Varsayilan"da kaliyordu (2026-09-05 fiziksel test).
   */
  private tercihiYayinla(): void {
    voice.girisTercihi = this.cihazSecimi.giris;
    voice.cikisTercihi = this.cihazSecimi.cikis;
  }

  /** Arayuz secili degeri buradan okur; etkin cihazdan AYRIDIR. */
  girisTercihi(): string | null {
    return this.cihazSecimi.giris;
  }

  cikisTercihi(): string | null {
    return this.cihazSecimi.cikis;
  }

  /**
   * Cihaz listesi degisti. Tercih hala varsa ona doneriz, yoksa varsayilana
   * duseriz -- ama TERCIHI SILMEYIZ: kulakligi geri takan kullanici onu
   * yeniden secmek zorunda kalmamali.
   */
  private async cihazlariGozden(): Promise<void> {
    const { girisler, cikislar } = await cihazlariListele(this.cihazDeps);

    const gTercih = this.cihazSecimi.giris;
    const gVar = gTercih === null || girisler.some((c) => c.id === gTercih);
    const gHedef = gVar ? gTercih : null;
    if (voice.etkinGiris !== gHedef) await this.mikrofonuUygula(gHedef);

    const cTercih = this.cihazSecimi.cikis;
    const cVar = cTercih === null || cikislar.some((c) => c.id === cTercih);
    const cHedef = cVar ? cTercih : null;
    if (voice.cikisCihazi !== cHedef) await this.cikisiUygula(cHedef);
  }

  /**
   * Track'in `ended`'i cihazin FIZIKSEL olarak gittigi anlamina gelir.
   * Sirayla: tercih, sonra varsayilan, o da olmazsa mikrofonsuz duruma gec.
   */
  private mikBittiDinle(track: MediaStreamTrack): void {
    track.addEventListener("ended", () => {
      if (this.media.mic !== track) return;   // eskimis olay
      void (async () => {
        if (await this.mikrofonuUygula(this.cihazSecimi.giris)) return;
        if (this.cihazSecimi.giris !== null && await this.mikrofonuUygula(null)) return;
        voice.mikYok = true;
        voice.etkinGiris = null;
        voice.error = "Mikrofon kayboldu. Ses ayarlarından başka bir cihaz seçebilirsin.";
      })();
    });
  }

  async setCikisCihazi(id: string | null): Promise<void> {
    this.cihazSecimi = { ...this.cihazSecimi, cikis: id };
    cihazSecimiYaz(this.cihazSecimi);
    this.tercihiYayinla();
    await this.cikisiUygula(id);
  }

  /**
   * Uzak sesin TAMAMI (mikrofon mikseri + ekran mikseri) bu tek AudioContext'ten
   * akiyor, bu yuzden tek cagri hepsini tasir ve gain.ts'e hic dokunulmaz.
   * Destek yoksa sessizce gecilir; arayuz secimi zaten devre disi cizer.
   */
  private async cikisiUygula(id: string | null): Promise<void> {
    const ctx = this.audioCtx as (AudioContext & {
      setSinkId?(v: string): Promise<void>;
    }) | null;
    // Bildirim calarin kendi context'i var; secim ona ayrica bildirilir,
    // yoksa bipler secili kulakliktan degil varsayilan hoparlorden gelir.
    void this.bildirim.setCikis(id);
    if (!ctx || typeof ctx.setSinkId !== "function") return;
    try {
      await ctx.setSinkId(id ?? "");   // "" = sistem varsayilani
      voice.cikisCihazi = id;
    } catch {
      // Cihaz kaybolmus olabilir. Sessiz sagirlik yerine varsayilana don.
      try {
        await ctx.setSinkId("");
      } catch {
        // Varsayilan da reddedildi; yapilacak baska bir sey yok.
      }
      voice.cikisCihazi = null;
      voice.error = "Çıkış cihazına geçilemedi, varsayılana dönüldü.";
    }
  }

  /**
   * Tercihi kaydeder ve uygular. Uygulanamazsa tercih yine de saklanir:
   * cihaz sonradan gelirse devicechange onu devreye alir.
   */
  async setGirisCihazi(id: string | null): Promise<void> {
    this.cihazSecimi = { ...this.cihazSecimi, giris: id };
    cihazSecimiYaz(this.cihazSecimi);
    this.tercihiYayinla();
    await this.mikrofonuUygula(id);
  }

  /**
   * Mikrofonu verilen cihaza alir. SIRA KRITIK: once yenisi alinir, sonra
   * mesh'e konur, ANCAK ondan sonra eskisi birakilir. Ters sirada karsi taraf
   * iki islem arasinda sessizlik duyar.
   *
   * `false` = degisemedi, mevcut duzen aynen duruyor.
   */
  private async mikrofonuUygula(id: string | null): Promise<boolean> {
    if (!this.audioCtx) return false;

    let yeni: MediaStreamTrack;
    let eski: MediaStreamTrack | null;
    try {
      ({ yeni, eski } = await this.media.mikDegistir(id));
    } catch {
      voice.error = "Seçilen mikrofona erişilemedi.";
      return false;
    }

    const eskiIsleyici = this.mikIsleyici;
    this.mikIsleyici = new MikrofonIsleyici({
      ctx: this.audioCtx,
      track: yeni,
      esik: voice.sesAyarlari.esik,
      onSeviye: this.seviyeGeldi,
    });
    this.mikIsleyici.setMod(voice.sesAyarlari.girisModu);

    // replaceTrack: yeni transceiver acilmaz, renegotiation olmaz.
    this.mesh?.setTrack("mic", this.gidenMik());

    eskiIsleyici?.close();
    eski?.stop();

    // Yeni track mute durumunu MIRAS ALMAZ.
    this.media.setMuted(voice.muted);
    voice.mikYok = false;
    voice.etkinGiris = id;
    this.mikBittiDinle(yeni);
    voice.error = null;
    return true;
  }

  /** Kapi esigi ve tarayici filtreleri; ikisi de yerel ve kaliciDIR. */
  async setSesAyarlari(a: SesAyarlari): Promise<void> {
    voice.sesAyarlari = a;
    sesAyarlariYaz(a);
    this.bildirim.setAcik(a.bildirimSesleri);
    this.mikIsleyici?.setEsik(a.esik);
    this.mikIsleyici?.setMod(a.girisModu);
    await this.media.setFiltreler(a);
  }

  /** Global kisayoldan gelir. Ses kanalinda degilken cagrilmaz (+page.svelte). */
  setPttBasili(basili: boolean): void {
    this.mikIsleyici?.setBasili(basili);
  }

  setMuted(muted: boolean, sessiz = false): void {
    if (voice.muted === muted) return;   // kota: degismeyen durum yayilmaz
    voice.muted = muted;
    this.media.setMuted(muted);
    if (!sessiz) this.bildirim.cal(muted ? "mik-kapandi" : "mik-acildi");
    this.publish();
  }

  /** Discord davranisi: deafen kendi mikrofonunu da kapatir. */
  setDeafened(deafened: boolean, sessiz = false): void {
    if (voice.deafened === deafened) return;
    voice.deafened = deafened;
    if (deafened) {
      // DIKKAT: alan dogrudan yaziliyor, `setMuted` cagrilmiyor. Boyle kalmali
      // -- `this.setMuted(true)`'a cevrilirse tek tikta hem kulaklik hem
      // mikrofon sesi calar.
      voice.muted = true;
      this.media.setMuted(true);
    }
    this.mixer?.setDeafened(deafened);
    this.micMixer?.setDeafened(deafened);
    if (!sessiz) this.bildirim.cal(deafened ? "kulaklik-kapandi" : "kulaklik-acildi");
    this.publish();
  }

  async setCamera(on: boolean): Promise<void> {
    if (voice.camera === on) return;
    if (on) {
      try {
        const track = await this.media.startCamera();
        this.mesh?.setTrack("cam", track);
      } catch {
        voice.error = "Kameraya erişilemedi.";
        return;
      }
    } else {
      this.mesh?.setTrack("cam", null);
      this.media.stopCamera();
    }
    // Yeni nesne: ayni referansi tekrar yazmak aboneleri uyandirmaz.
    voice.local = { ...voice.local, cam: on ? this.media.cam : null };
    voice.camera = on;
    this.publish();
  }

  async startScreen(): Promise<void> {
    if (voice.screen) return;
    let video: MediaStreamTrack;
    let audio: MediaStreamTrack | null;
    try {
      ({ video, audio } = await this.media.startScreen(this.ekranKalitesi()));
    } catch (e) {
      // NotAllowedError = kullanici native secicide vazgecti. Hata
      // GOSTERILMEZ; vazgecmek bir ariza degil (spec 8.1 adim 3).
      if ((e as DOMException)?.name !== "NotAllowedError") {
        voice.error = "Ekran paylaşımı başlatılamadı.";
      }
      return;
    }

    // Ayri transceiver'lar: izleyicinin ekran sesini mikrofondan bagimsiz
    // kisabilmesi buna bagli (spec 8.1 adim 4).
    this.mesh?.setTrack("screenVideo", video);
    this.mesh?.setTrack("screenAudio", audio);

    this.ekranBittiDinle(video);

    voice.local = { ...voice.local, screenVideo: video };
    voice.screen = true;
    voice.screenAudio = audio !== null;
    this.publish();
  }

  /**
   * Paylasim SURERKEN kaynagi degistirir: native secici yeniden acilir, secilen
   * yuzey replaceTrack ile yerine gecer (mesh.setTrack). Yeniden gorusme YOK,
   * `voice.screen` hic false'a dusmez -- karsi taraf kopma gormez.
   *
   * Vazgecmek bir ariza degil: eski paylasim aynen surer, hata gosterilmez.
   */
  async degistirEkran(): Promise<void> {
    if (!voice.screen) return;
    let video: MediaStreamTrack;
    let audio: MediaStreamTrack | null;
    try {
      ({ video, audio } = await this.media.startScreen(this.ekranKalitesi()));
    } catch (e) {
      if ((e as DOMException)?.name !== "NotAllowedError") {
        voice.error = "Ekran kaynağı değiştirilemedi.";
      }
      return;
    }

    this.mesh?.setTrack("screenVideo", video);
    this.mesh?.setTrack("screenAudio", audio);
    this.ekranBittiDinle(video);

    voice.local = { ...voice.local, screenVideo: video };
    // Yeni secimde sistem sesi kutusu isaretlenmemis olabilir.
    voice.screenAudio = audio !== null;
    this.publish();
  }

  /**
   * Ekran kalitesi tercihi. Paylasim suruyorsa canli uygulanir; track ayni
   * kalir, izleyici kopma gormez ve sunucuya hicbir sey gitmez.
   *
   * Store ANCAK kisit tuttuktan sonra yazilir: menu o an gercekten gecerli
   * olani gostermeli. Patlarsa yakalama eski ayarla surer.
   */
  async setEkranKalitesi(k: EkranKalitesi): Promise<void> {
    try {
      await this.media.ekranKalitesiUygula(k);
    } catch {
      voice.error = "Ekran kalitesi değiştirilemedi.";
      return;
    }
    voice.ekranKalitesi = k;
    ekranKalitesiYaz(k);
  }

  /** Teshis: her izleyiciye GERCEKTE giden ekran akisi (`kovanEkran()`). */
  async ekranIstatistikleri(): Promise<Array<{ userId: string; giden: EkranOzeti | null }>> {
    return this.mesh ? this.mesh.ekranIstatistikleri() : [];
  }

  /** Store proxy'si LocalMedia'ya sizmasin: duz kopya verilir. */
  private ekranKalitesi(): EkranKalitesi {
    return { ...voice.ekranKalitesi };
  }

  /**
   * Kullanici bizim seridimizi degil Chromium'un cubugunu kullanabilir; bu
   * dinleyici olmadan digerleri olu bir kare gorur (spec 8.1 adim 6).
   *
   * Guncellik kontrolu SART: kaynak degistirildiginde eski track duruyor.
   * `stop()` spec'e gore `ended` atesLEMEZ ama buna guvenmiyoruz -- eski
   * track'in olayi yeni paylasimi kapatirdi.
   */
  private ekranBittiDinle(track: MediaStreamTrack): void {
    track.addEventListener("ended", () => {
      if (this.media.screenVideo !== track) return;
      this.stopScreen();
    });
  }

  stopScreen(): void {
    if (!voice.screen) return;
    this.mesh?.setTrack("screenVideo", null);
    this.mesh?.setTrack("screenAudio", null);
    this.media.stopScreen();
    voice.local = { ...voice.local, screenVideo: null };
    voice.screen = false;
    voice.screenAudio = false;
    this.publish();
  }

  destroy(): void {
    this.katilmaNiyeti = false;
    this.leave();
    this.o.conn.onVoiceMembers = null;
    this.o.conn.onSignal = null;
    this.o.conn.onDisconnect = null;
    this.o.conn.onReconnect = null;
  }

  private publish(): void {
    this.o.conn.send({ t: "voice.state", ...localFlags() });
  }

  private onMembers(members: VoiceMember[]): void {
    if (!this.mesh || !voice.joined) return;
    const idler = members.map((m) => m.userId);
    const fark = uyeFarki(this.oncekiUyeler, idler, this.o.selfId);
    this.oncekiUyeler = idler;
    // Sagirken baskasinin girip cikmasi duyulmaz. Kendi eylem seslerin
    // (setMuted/setDeafened/join/leave) sagirken de calar; yoksa "kulaligi
    // actim" sesini hic duyamazdin.
    if (!voice.deafened) {
      for (const _ of fark.girenler) this.bildirim.cal("baskasi-girdi");
      for (const _ of fark.cikanlar) this.bildirim.cal("baskasi-cikti");
    }
    this.mesh.setMembers(idler);
  }

  private createPeer(userId: string, polite: boolean): Peer {
    const pc = (this.o.createPeerConnection ?? ((cfg: RTCConfiguration) => new RTCPeerConnection(cfg)))(
      { iceServers: this.ice });

    const peer = new Peer({
      polite,
      pc,
      sendSignal: (data) => this.o.conn.send({ t: "signal", target: userId, data }),
      onTrack: (slot, track) => this.onRemoteTrack(userId, slot, track),
      onStateChange: (durum) => voice.connection.set(userId, durum),
    });

    // Baglanti kurulur kurulmaz yerel track'ler yerine oturur. replaceTrack
    // yeni transceiver acmaz, bu yuzden ekstra negotiation turu olmaz.
    peer.setTrack("mic", this.gidenMik());
    peer.setTrack("cam", this.media.cam);
    peer.setTrack("screenVideo", this.media.screenVideo);
    peer.setTrack("screenAudio", this.media.screenAudio);
    return peer;
  }

  private onRemoteTrack(userId: string, slot: TrackSlot, track: MediaStreamTrack): void {
    // Yeni nesne yazilir: SvelteMap ayni referansi tekrar set edince
    // aboneleri uyandirmaz.
    const yaz = (t: MediaStreamTrack | null) => {
      const mevcut = voice.remote.get(userId) ?? bosTracks();
      if (mevcut[slot] === t) return;
      voice.remote.set(userId, { ...mevcut, [slot]: t });
    };

    // Track geldigi anda yazilir ve `ended` gelene kadar store'da KALIR.
    //
    // Onceden mute/unmute olaylari yuvayi doldurup bosaltiyordu; amac karsi
    // taraf kamerayi hic acmamisken bos siyah kare cizmemekti. Ama Chrome
    // mute'u gecici paket kaybinda ve bant genisligi dususunde de atesliyor:
    // yuva null oluyor, <video> DOM'dan sokuluyor, kare siyaha dusup geri
    // geliyor. Gozlenen titremenin ikinci kaynagi buydu.
    //
    // "Kamera kapali" ile "ag takildi" RTP seviyesinde ayni sinyaldir; ayirt
    // eden bilgi sunucudan gelen VoiceMember.camera / .screen bayraklaridir.
    // Gorunurluk karari bu yuzden stage.ts'te o bayraklardan veriliyor.
    yaz(track);
    if (slot === "mic") {
      // SIRA ONEMLI: once mikser kaynagi acar, gosterge onu ODUNC ALIR.
      // Ikinci bir kaynak acilirsa Chrome ona sessizlik verir.
      this.micMixer?.attach(userId, track);
      const kaynak = this.micMixer?.sourceOf(userId) ?? null;
      if (kaynak) this.speaking?.watchSource(userId, kaynak);
      else this.speaking?.watch(userId, track);
    }
    if (slot === "screenAudio") this.mixer?.attach(userId, track);

    track.addEventListener("ended", () => {
      yaz(null);
      if (slot === "screenAudio") this.mixer?.detach(userId);
      if (slot === "mic") this.micMixer?.detach(userId);
    });
  }

  /** `null` = alinamadi. Ilk katilimda YEDEK_ICE'a duser, tazelemede eski korunur. */
  private async fetchIce(): Promise<RTCIceServer[] | null> {
    const f = this.o.fetchImpl ?? fetch;
    try {
      const res = await f(`${this.o.apiUrl}/api/turn?token=${encodeURIComponent(this.o.token)}`);
      if (!res.ok) return null;
      const govde = await res.json() as { iceServers?: RTCIceServer[] };
      return govde.iceServers?.length ? govde.iceServers : null;
    } catch {
      return null;
    }
  }
}
