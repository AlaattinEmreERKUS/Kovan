import type { DepoBenzeri } from "./gorunum";

/**
 * Kopma TESHIS kaydi. 2026-09-18: herkes kabaca 30 dk'da bir, tek tek dusup
 * geri baglaniyor ve sebebi bilinmiyor -- `onclose` kapanma kodunu okumuyordu,
 * sunucuda observability kapali. Bu kayit hangi katmanin koptugunu ayirir:
 *   ws   -> sinyal socket'i kapandi (1006 ag, 1001/1012 sunucu gitti)
 *   peer -> WebRTC yolu bozuldu, socket ayaktayken
 * Konsolda `kovanKopmalar()` ile okunur. Token ya da icerik tutmaz.
 */
export type KopmaOlayi =
  | {
      tur: "ws";
      kod: number;
      sebep: string;
      temiz: boolean;
      acikKaldiSn: number;
      /** Kapanmadan once son cercevenin (pong dahil) uzerinden gecen sure. */
      sessizSn?: number;
      /** Kapanma anindaki tarayici ipuclari: ag yok mu, sekme gizli mi. */
      cevrimici?: boolean;
      gorunurluk?: string;
    }
  | { tur: "peer"; userId: string; durum: RTCPeerConnectionState };

export type KopmaKaydi = KopmaOlayi & { zaman: string };

const ANAHTAR = "kovan_kopmalar";
// 50 peer "connected" gurultusuyle yarim gunde doluyordu (2026-09-19).
export const KAYIT_TAVANI = 200;

function varsayilanDepo(): DepoBenzeri | null {
  try {
    return typeof localStorage === "undefined" ? null : localStorage;
  } catch {
    return null;
  }
}

export function kopmalariOku(depo: DepoBenzeri | null = varsayilanDepo()): KopmaKaydi[] {
  if (!depo) return [];
  try {
    const ham = JSON.parse(depo.getItem(ANAHTAR) ?? "[]");
    return Array.isArray(ham) ? (ham as KopmaKaydi[]) : [];
  } catch {
    return [];
  }
}

export function kopmaKaydet(
  olay: KopmaOlayi,
  depo: DepoBenzeri | null = varsayilanDepo(),
  simdi: number = Date.now(),
): void {
  if (!depo) return;
  const kayitlar = [...kopmalariOku(depo), { zaman: new Date(simdi).toISOString(), ...olay }];
  try {
    depo.setItem(ANAHTAR, JSON.stringify(kayitlar.slice(-KAYIT_TAVANI)));
  } catch {
    // Teshis kaydi yazilamadi; uygulama bunun icin durmaz.
  }
}
