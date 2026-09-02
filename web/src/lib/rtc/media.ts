export interface MediaDeps {
  getUserMedia(c: MediaStreamConstraints): Promise<MediaStream>;
  getDisplayMedia(o: DisplayMediaStreamOptions): Promise<MediaStream>;
}

/**
 * Tarayici hoparlorunun mikrofona geri beslemesi echoCancellation olmadan
 * mesh'te herkese yankiyla gider; ucu de acik birakilir.
 */
export const MIC_CONSTRAINTS: MediaStreamConstraints = {
  audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true },
  video: false,
};

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

  async startMic(): Promise<MediaStreamTrack> {
    // Zaten acikken yeniden istemek Chrome'da izin balonunu tekrar acabilir.
    if (this.mic) return this.mic;
    const stream = await this.deps.getUserMedia(MIC_CONSTRAINTS);
    this.mic = stream.getAudioTracks()[0];
    return this.mic;
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

  stopAll(): void {
    for (const t of [this.mic, this.cam, this.screenVideo, this.screenAudio]) t?.stop();
    this.mic = null;
    this.cam = null;
    this.screenVideo = null;
    this.screenAudio = null;
  }
}
