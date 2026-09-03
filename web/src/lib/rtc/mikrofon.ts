import { kapiKarari, kapiKapali, type KapiDurumu } from "./kapi";
import { rmsOf } from "./speaking";

export interface IsleyiciSecenekleri {
  ctx: AudioContext;
  /** Ham mikrofon track'i. Cikisa DOGRUDAN gitmez, kapidan gecer. */
  track: MediaStreamTrack;
  esik: number;
  /** Her ornekte cagrilir: arayuzdeki seviye cubugu ve konusma gostergesi. */
  onSeviye?(seviye: number, acik: boolean): void;
  makeStream?(t: MediaStreamTrack): MediaStream;
  /** Testte zamani sabitlemek icin; varsayilan performance.now. */
  simdi?(): number;
}

const ARALIK_MS = 50;
/** Kapinin acilip kapanma yumusakligi; sifir olursa "tık" duyulur. */
const ACILMA_S = 0.01;
const KAPANMA_S = 0.08;

/**
 * Giden mikrofonu kapidan (noise gate) gecirir.
 *
 * Tarayicinin noiseSuppression'i mikrofonu KAPATMAZ: klavye, fan, nefes
 * karsi tarafa gider. Kapi, seviye esigin altindayken kazanci sifirlar.
 * Mesh'e gonderilen track artik `cikis`tir; ham track yalniz olcum ve
 * mute icin durur.
 */
export class MikrofonIsleyici {
  private source: MediaStreamAudioSourceNode;
  private analyser: AnalyserNode;
  private gain: GainNode;
  private hedef: MediaStreamAudioDestinationNode;
  private tampon: Float32Array<ArrayBuffer>;
  // sonSes 0 OLAMAZ: saat de 0'dan baslarsa "son sesin uzerinden 0 ms gecti"
  // sayilir ve kapi ilk BEKLEME_MS boyunca acik kalir.
  private durum: KapiDurumu = { acik: false, sonSes: Number.NEGATIVE_INFINITY };
  private zamanlayici: ReturnType<typeof setInterval> | null = null;
  private esik: number;

  /** Mesh'e verilecek track. */
  readonly cikis: MediaStreamTrack;

  constructor(private o: IsleyiciSecenekleri) {
    this.esik = o.esik;
    const stream = (o.makeStream ?? ((t: MediaStreamTrack) => new MediaStream([t])))(o.track);
    this.source = o.ctx.createMediaStreamSource(stream);
    this.analyser = o.ctx.createAnalyser();
    this.analyser.fftSize = 2048;
    this.gain = o.ctx.createGain();
    this.hedef = o.ctx.createMediaStreamDestination();

    this.source.connect(this.analyser);
    this.source.connect(this.gain);
    this.gain.connect(this.hedef);
    // Kapi kapali baslar: acilis sesi (mikrofon patlamasi) gitmesin.
    this.gain.gain.value = kapiKapali(this.esik) ? 1 : 0;

    this.tampon = new Float32Array(this.analyser.fftSize);
    this.cikis = this.hedef.stream.getAudioTracks()[0];
    this.zamanlayici = setInterval(() => this.ornekle(), ARALIK_MS);
  }

  setEsik(esik: number): void {
    this.esik = esik;
    // Kapi devre disi birakildiginda acik kalmali; aksi halde bir sonraki
    // orneklemeye kadar ses kesik gider.
    if (kapiKapali(esik)) this.uygula(true);
  }

  close(): void {
    if (this.zamanlayici !== null) clearInterval(this.zamanlayici);
    this.zamanlayici = null;
    this.source.disconnect();
    this.analyser.disconnect();
    this.gain.disconnect();
    this.cikis.stop();
  }

  private ornekle(): void {
    this.analyser.getFloatTimeDomainData(this.tampon);
    const seviye = rmsOf(this.tampon);

    if (kapiKapali(this.esik)) {
      this.uygula(true);
      this.o.onSeviye?.(seviye, true);
      return;
    }
    // Mod simdilik sabit; gercek modu ve tus durumunu Gorev 5 bagliyor.
    this.durum = kapiKarari({
      mod: "ses-etkinligi",
      seviye,
      esik: this.esik,
      basili: false,
      onceki: this.durum,
      simdi: this.o.simdi?.() ?? performance.now(),
    });
    this.uygula(this.durum.acik);
    this.o.onSeviye?.(seviye, this.durum.acik);
  }

  private uygula(acik: boolean): void {
    // setTargetAtTime kesme yerine yumusatir; ani sifirlama "tık" yapar.
    this.gain.gain.setTargetAtTime(acik ? 1 : 0, this.o.ctx.currentTime, acik ? ACILMA_S : KAPANMA_S);
  }
}
