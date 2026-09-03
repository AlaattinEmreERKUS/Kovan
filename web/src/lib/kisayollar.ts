/**
 * Kisayol tercihleri. KISIYE OZEL ve yerel: sunucuya gitmez.
 *
 * Karar saf tutuluyor; kisayollari gercekten kaydeden taraf Rust
 * (`desktop/src-tauri/src/lib.rs`), buradan yalnizca metin gidiyor.
 */
import { KISAYOL_ADLARI, type KisayolAdi } from "./masaustu";

export type Kisayollar = Record<KisayolAdi, string>;

/**
 * Fonksiyon tuslari secildi: oyun oynarken cakisma ihtimali dusuk ve tek
 * tusla basilabiliyor. Kullanici degistirebilir.
 */
export const KISAYOL_VARSAYILAN: Kisayollar = {
  ptt: "F8",
  mik: "F9",
  kulaklik: "F10",
};

/** Rust'in her kisayol icin dondurdugu kayit sonucu. */
export interface KayitSonucu {
  ad: KisayolAdi;
  kayitli: boolean;
  sebep?: string;
}

const ANAHTAR = "kovan_kisayollar";
const MAKS_UZUNLUK = 64;

export interface DepoBenzeri {
  getItem(anahtar: string): string | null;
  setItem(anahtar: string, deger: string): void;
}

function varsayilanDepo(): DepoBenzeri | null {
  try {
    return typeof localStorage === "undefined" ? null : localStorage;
  } catch {
    return null;
  }
}

function tus(v: unknown, varsayilan: string): string {
  if (typeof v !== "string") return varsayilan;
  const k = v.trim();
  return k.length === 0 || k.length > MAKS_UZUNLUK ? varsayilan : k;
}

export function kisayollariOku(depo: DepoBenzeri | null = varsayilanDepo()): Kisayollar {
  if (!depo) return { ...KISAYOL_VARSAYILAN };
  try {
    const ham = depo.getItem(ANAHTAR);
    if (ham === null) return { ...KISAYOL_VARSAYILAN };
    const o = JSON.parse(ham) as Partial<Kisayollar>;
    const sonuc = { ...KISAYOL_VARSAYILAN };
    for (const ad of KISAYOL_ADLARI) sonuc[ad] = tus(o[ad], KISAYOL_VARSAYILAN[ad]);
    return sonuc;
  } catch {
    // Bozuk kayit varsayilana doner; kisayolsuz kalmak uygulamayi durdurmaz.
    return { ...KISAYOL_VARSAYILAN };
  }
}

export function kisayollariYaz(k: Kisayollar, depo: DepoBenzeri | null = varsayilanDepo()): void {
  if (!depo) return;
  try {
    depo.setItem(ANAHTAR, JSON.stringify(k));
  } catch {
    // Kota dolu ya da yazma engelli: tercih kalici olmaz, kisayol yine calisir.
  }
}
