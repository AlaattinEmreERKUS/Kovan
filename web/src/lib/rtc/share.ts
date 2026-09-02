declare global {
  // TypeScript'in DOM tipleri bu iki alani her surumde tasimiyor.
  interface DisplayMediaStreamOptions {
    systemAudio?: "include" | "exclude";
    surfaceSwitching?: "include" | "exclude";
  }
}

/**
 * Web'de yuzey ve sistem sesi secimi TARAYICININ kendi secicisinde yapilir:
 * ekran / pencere / sekme listesi ve "ses de paylas" kutusu orada. Kendi
 * on-diyalogumuz ayni sorulari bir kez daha sorup secicinin secenegini
 * daraltiyordu -- kaldirildi (2026-09-02).
 *
 * Bu yuzden `displaySurface` VERILMEZ: verilseydi native secici on-filtrelenir
 * ve kullanici pencere paylasamazdi. `systemAudio: "include"` yalnizca kutuyu
 * SUNAR, isaretlemeyi kullanici yapar; isaretlemezse audio track hic gelmez
 * (Windows'ta pencere yakalamada zaten gelmez) ve serit "sistem sesi acik"
 * yazmaz.
 *
 * Tauri paketinde native secici degistirilebilirse kendi arayuzumuz geri
 * gelebilir; o zaman constraint'ler yine buradan uretilir.
 */
export function buildConstraints(): DisplayMediaStreamOptions {
  return {
    video: { frameRate: 30 },
    audio: true,
    systemAudio: "include",
    surfaceSwitching: "include",
  };
}
