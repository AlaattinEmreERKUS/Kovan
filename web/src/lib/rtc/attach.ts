/**
 * Svelte action: bir track'i media element'ine bagla. `srcObject` icin bind:
 * yok, bu yuzden action gerekiyor.
 */
export function attachStream(node: HTMLMediaElement, track: MediaStreamTrack) {
  bagla(node, track);
  return {
    update(yeni: MediaStreamTrack) {
      bagla(node, yeni);
    },
    destroy() {
      node.srcObject = null;
    },
  };
}

/**
 * srcObject'e AYNI track'i yeniden yazmak <video>'yu sifirlar: element
 * readyState 0'a duser ve bir kare boyunca siyah cizer.
 *
 * Svelte action update'i "coarse-grained": parametre nesne oldugunda
 * `safe_not_equal` DAIMA true doner (svelte/internal/client/dom/elements/
 * actions.js), yani prop her degistiginde update cagriliyor. Sahne kareleri
 * her konusma bayragi degisiminde (100 ms'lik ornekleme) yeniden turetildigi
 * icin herkesin videosu birlikte siyah parliyordu. Degisen bir sey yoksa
 * srcObject'e dokunma.
 */
function bagla(node: HTMLMediaElement, track: MediaStreamTrack): void {
  const mevcut = node.srcObject as MediaStream | null;
  const izler = typeof mevcut?.getTracks === "function" ? mevcut.getTracks() : null;
  const ayni = izler !== null && izler.length === 1 && izler[0] === track;
  if (!ayni) node.srcObject = new MediaStream([track]);
  oynat(node);
}

/**
 * `autoplay` ozniteligi TEK BASINA yetmez. Elemanin "can autoplay" bayragi
 * bir kez tuketildikten sonra srcObject'e yazmak oynatmayi baslatmaz; video
 * hazir veriyle (readyState 4, dogru videoWidth) ama `paused: true` olarak
 * durur ve siyah cizer. Canlida gorulen tam olarak buydu: kamera da ekran da
 * DOM'daydi, track'ler canliydi, tek fark `paused` idi.
 *
 * Bu yuzden baglama sonrasi oynatma ACIKCA istenir. Ayni track ile gelen
 * update'te srcObject'e dokunulmaz -- titreme oradan geliyordu -- ama
 * duraklamis video yine de kurtarilir.
 */
function oynat(node: HTMLMediaElement): void {
  if (!node.paused) return;
  // Reddedilebilir (otomatik oynatma engeli, eleman DOM'dan koptu). Ariza
  // degil: sessizce birak, bir sonraki update yeniden dener.
  node.play().catch(() => {});
}

/**
 * Svelte action: bir media element'ini secili CIKIS cihazina baglar.
 *
 * Yalnizca RemoteAudio'nun yedek yolu icin gerekli. Normalde uzak ses
 * AudioContext'ten akar ve yonlendirme orada yapilir; mikser kurulamadiginda
 * duyulan TEK yol bu elementlerdir ve onlar kendi baslarina varsayilan
 * cihaza calar.
 */
export function cikisaBagla(node: HTMLMediaElement, cihazId: string | null) {
  sinkUygula(node, cihazId);
  return {
    update(yeni: string | null) {
      sinkUygula(node, yeni);
    },
  };
}

function sinkUygula(node: HTMLMediaElement, cihazId: string | null): void {
  const el = node as HTMLMediaElement & { setSinkId?(v: string): Promise<void> };
  if (typeof el.setSinkId !== "function") return;
  // Reddedilebilir (cihaz kayboldu, izin yok). Ariza degil: varsayilandan calar.
  void el.setSinkId(cihazId ?? "").catch(() => {});
}
