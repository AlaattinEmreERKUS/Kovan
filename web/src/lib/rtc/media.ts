import { buildConstraints } from "./share";
import { mikKisitlari, sesAyarlariOku, type SesAyarlari } from "../ses-ayarlari";

export interface MediaDeps {
  getUserMedia(c: MediaStreamConstraints): Promise<MediaStream>;
  getDisplayMedia(o: DisplayMediaStreamOptions): Promise<MediaStream>;
}

/**
 * Tarayici hoparlorunun mikrofona geri beslemesi echoCancellation olmadan
 * mesh'te herkese yankiyla gider; ucu de acik birakilir.
 */
export function micConstraints(
  a: SesAyarlari = sesAyarlariOku(),
  cihazId: string | null = null,
): MediaStreamConstraints {
  const audio: MediaTrackConstraints = mikKisitlari(a);
  // `exact`: cihaz yoksa sessizce baskasina dusmek yerine hata versin, cunku
  // "sectigim mikrofon calisiyor mu" sorusunun cevabi belirsiz kalmamali.
  if (cihazId) audio.deviceId = { exact: cihazId };
  return { audio, video: false };
}

export const CAM_CONSTRAINTS: MediaStreamConstraints = {
  audio: false,
  video: { width: { ideal: 1280 }, height: { ideal: 720 }, frameRate: { ideal: 30 } },
};

export function browserMediaDeps(): MediaDeps {
  return {
    getUserMedia: (c) => navigator.mediaDevices.getUserMedia(c),
    getDisplayMedia: (o) => navigator.mediaDevices.getDisplayMedia(o),
  };
}

/** Yerel track'lerin tek sahibi. Mesh bu track'leri yalnizca odunc alir. */
export class LocalMedia {
  mic: MediaStreamTrack | null = null;
  cam: MediaStreamTrack | null = null;
  screenVideo: MediaStreamTrack | null = null;
  screenAudio: MediaStreamTrack | null = null;

  constructor(private deps: MediaDeps = browserMediaDeps()) {}

  async startMic(cihazId: string | null = null): Promise<MediaStreamTrack> {
    // Zaten acikken yeniden istemek Chrome'da izin balonunu tekrar acabilir.
    if (this.mic) return this.mic;
    const stream = await this.deps.getUserMedia(micConstraints(sesAyarlariOku(), cihazId));
    this.mic = stream.getAudioTracks()[0];
    return this.mic;
  }

  /**
   * Acikken BASKA cihaza gecer. Eskiyi BILEREK durdurmaz: cagiran once
   * replaceTrack ile yeni track'i mesh'e koyar, ANCAK sonra eskisini birakir.
   * Burada durdurursak iki islem arasinda karsi taraf sessizlik duyar.
   * Istek patlarsa hicbir sey degismemis olur (startScreen ile ayni kural).
   */
  async mikDegistir(
    cihazId: string | null,
  ): Promise<{ yeni: MediaStreamTrack; eski: MediaStreamTrack | null }> {
    const stream = await this.deps.getUserMedia(micConstraints(sesAyarlariOku(), cihazId));
    const yeni = stream.getAudioTracks()[0];
    const eski = this.mic;
    this.mic = yeni;
    return { yeni, eski };
  }

  /**
   * Filtreleri CANLI degistirir: mikrofonu yeniden istemek Chrome'da izin
   * balonunu tekrar acabilir ve track degisince yeniden negotiation gerekir.
   */
  async setFiltreler(a: SesAyarlari): Promise<void> {
    if (!this.mic) return;
    try {
      await this.mic.applyConstraints(mikKisitlari(a));
    } catch {
      // Bazi cihazlar bu kisitlari desteklemez; ses filtresiz devam eder.
    }
  }

  /**
   * Mute track'i DURDURMAZ, devre disi birakir: durdurulan track yeniden
   * baslatilamaz ve her mute/unmute yeni bir negotiation turu baslatir.
   */
  setMuted(muted: boolean): void {
    if (this.mic) this.mic.enabled = !muted;
  }

  async startCamera(): Promise<MediaStreamTrack> {
    if (this.cam) return this.cam;
    const stream = await this.deps.getUserMedia(CAM_CONSTRAINTS);
    this.cam = stream.getVideoTracks()[0];
    return this.cam;
  }

  stopCamera(): void {
    this.cam?.stop();
    this.cam = null;
  }

  /**
   * Native secici acilir (secici DEGISTIRILEMEZ, spec 8.1 kisit 1). Yuzey ve
   * sistem sesi secimi orada yapilir; kendi on-diyalogumuz yok (share.ts).
   */
  async startScreen(): Promise<{ video: MediaStreamTrack; audio: MediaStreamTrack | null }> {
    const stream = await this.deps.getDisplayMedia(buildConstraints());
    // Paylasim SURERKEN kaynak degistirilebilir. Eskiyi ancak yeni akis
    // GELDIKTEN sonra birakiyoruz: once biraksaydik secicide vazgecen
    // kullanici paylasimini komple kaybederdi. Birakmasaydik da eski
    // yakalama arka planda okumaya devam ederdi.
    this.screenVideo?.stop();
    this.screenAudio?.stop();
    this.screenVideo = stream.getVideoTracks()[0];
    // Ses kutusu native secicide isaretlenmemis olabilir; o zaman audio
    // track hic gelmez ve serit "sistem sesi acik" yazmaz.
    this.screenAudio = stream.getAudioTracks()[0] ?? null;
    return { video: this.screenVideo, audio: this.screenAudio };
  }

  stopScreen(): void {
    this.screenVideo?.stop();
    this.screenAudio?.stop();
    this.screenVideo = null;
    this.screenAudio = null;
  }

  stopAll(): void {
    for (const t of [this.mic, this.cam, this.screenVideo, this.screenAudio]) t?.stop();
    this.mic = null;
    this.cam = null;
    this.screenVideo = null;
    this.screenAudio = null;
  }
}
