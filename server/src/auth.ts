/**
 * workerd (uretim) PBKDF2'de 100.000 iterasyon tavani koyuyor:
 * "NotSupportedError: iteration counts above 100000 are not supported".
 * Lokal test kosucusu bu tavani uygulamadigi icin 600.000 ile butun testler
 * yesildi ama CANLIDA kayit ve giris tamamen oluydu (1101).
 *
 * Cozum: spec'in istedigi 600.000'lik is faktorunu ZINCIRLEYEREK koru. Her
 * turun 256 bitlik ciktisi bir sonraki turun girdisi oluyor; turlar sirali
 * oldugu icin saldirgan da 600.000 HMAC yapmak zorunda.
 */
export const TUR_SAYISI = 6;
export const TUR_ITERASYON = 100_000;

function toHex(bytes: Uint8Array): string {
  return [...bytes].map((b) => b.toString(16).padStart(2, "0")).join("");
}

function fromHex(hex: string): Uint8Array {
  const out = new Uint8Array(hex.length / 2);
  for (let i = 0; i < out.length; i++) out[i] = parseInt(hex.slice(i * 2, i * 2 + 2), 16);
  return out;
}

export function newSalt(): string {
  return toHex(crypto.getRandomValues(new Uint8Array(16)));
}

export function newSessionToken(): string {
  return toHex(crypto.getRandomValues(new Uint8Array(32)));
}

export async function hashPassword(password: string, saltHex: string): Promise<string> {
  const salt = fromHex(saltHex);
  let girdi: Uint8Array = new TextEncoder().encode(password);

  for (let tur = 0; tur < TUR_SAYISI; tur++) {
    const key = await crypto.subtle.importKey("raw", girdi, "PBKDF2", false, ["deriveBits"]);
    const bits = await crypto.subtle.deriveBits(
      { name: "PBKDF2", salt, iterations: TUR_ITERASYON, hash: "SHA-256" },
      key,
      256
    );
    girdi = new Uint8Array(bits);
  }

  return toHex(girdi);
}

export async function hashToken(token: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(token));
  return toHex(new Uint8Array(digest));
}

/** Uzunluk eşitse sabit zamanda karşılaştırır. Hash karşılaştırması için. */
export function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}
