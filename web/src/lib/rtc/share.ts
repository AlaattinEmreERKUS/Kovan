declare global {
  // TypeScript'in DOM tipleri bu iki alani her surumde tasimiyor.
  interface DisplayMediaStreamOptions {
    systemAudio?: "include" | "exclude";
    surfaceSwitching?: "include" | "exclude";
  }
}

export type Surface = "monitor" | "window";

export interface ShareOptions {
  surface: Surface;
  systemAudio: boolean;
}

/**
 * Windows'ta pencere yakalamada sistem sesi GELMEZ. Anahtari acik birakip
 * sessiz bir paylasim gondermek, kullaniciya "sesim gitmiyor" dedirtir ve
 * sebebi arayuzde hicbir yerde yazmaz.
 */
export function systemAudioAvailable(surface: Surface): boolean {
  return surface === "monitor";
}

/**
 * `displaySurface` native seciciyi ON-FILTRELER (secici degistirilemez, spec
 * 8.1 kisit 1). `surfaceSwitching` kullanicinin paylasimi yeniden baslatmadan
 * yuzey degistirmesini acar.
 */
export function buildConstraints(o: ShareOptions): DisplayMediaStreamOptions {
  const sesVar = o.systemAudio && systemAudioAvailable(o.surface);
  return {
    video: { frameRate: 30, displaySurface: o.surface },
    audio: sesVar,
    systemAudio: sesVar ? "include" : "exclude",
    surfaceSwitching: "include",
  };
}
