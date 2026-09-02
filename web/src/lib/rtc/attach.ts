/**
 * Svelte action: bir track'i media element'ine bagla. `srcObject` icin bind:
 * yok, bu yuzden action gerekiyor.
 */
export function attachStream(node: HTMLMediaElement, track: MediaStreamTrack) {
  node.srcObject = new MediaStream([track]);
  return {
    update(yeni: MediaStreamTrack) {
      node.srcObject = new MediaStream([yeni]);
    },
    destroy() {
      node.srcObject = null;
    },
  };
}
