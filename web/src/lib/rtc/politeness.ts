/**
 * Cakismada (glare) kim geri adim atar. Kucuk userId polite'tir (spec 8).
 * Iki taraf da AYNI kurali uygular, bu yuzden tam olarak biri geri adim atar;
 * ikisi de atarsa baglanti hic kurulmaz, hicbiri atmazsa rastgele kopar.
 */
export function isPolite(myId: string, theirId: string): boolean {
  return myId < theirId;
}
