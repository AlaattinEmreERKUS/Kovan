import type { Env } from "./worker";

export interface IceServer {
  urls: string[];
  username?: string;
  credential?: string;
}

/**
 * Secret tanimli degilken (yerel gelistirme, TURN anahtari uretilmeden onceki
 * deploy) donen yedek. Ev aglarinin cogunda mesh yalnizca STUN ile kurulur;
 * simetrik NAT arkasindaki kullanici baglanamaz.
 */
export const STUN_ONLY: IceServer[] = [
  { urls: ["stun:stun.cloudflare.com:3478", "stun:stun.cloudflare.com:53"] },
];

const UC = (keyId: string) =>
  `https://rtc.live.cloudflare.com/v1/turn/keys/${keyId}/credentials/generate-ice-servers`;

/** Credential omru. Kisa tutulur: sizan bir credential bir saat sonra oludur. */
const TTL = 3600;

/**
 * Kisa omurlu TURN credential uretir. API token ISTEMCIYE GITMEZ; bu fonksiyon
 * yalnizca sunucuda calisir ve donen govde dogrudan RTCPeerConnection'a verilir.
 *
 * Her hata yolu STUN_ONLY'ye duser: TURN yoksa cogu kullanici yine baglanir,
 * ama istisna firlatirsak ses kanali herkes icin komple olur.
 */
export async function iceServers(env: Env, userId: string): Promise<IceServer[]> {
  const keyId = env.TURN_KEY_ID;
  const token = env.TURN_KEY_API_TOKEN;
  if (!keyId || !token) return STUN_ONLY;

  try {
    const res = await fetch(UC(keyId), {
      method: "POST",
      headers: { authorization: `Bearer ${token}`, "content-type": "application/json" },
      body: JSON.stringify({ ttl: TTL, customIdentifier: userId }),
    });
    if (!res.ok) return STUN_ONLY;

    const govde = await res.json<{ iceServers?: IceServer | IceServer[] }>();
    // Dokumantasyon bu alani dizi olarak gosteriyor, eski surumler tek nesne
    // donduruyordu. Ikisini de kabul et: yanlis tahmin sessiz bir "TURN yok"
    // demek olur ve teshisi zordur.
    const ham = govde.iceServers;
    const liste = Array.isArray(ham) ? ham : ham ? [ham] : [];
    return liste.length > 0 ? liste : STUN_ONLY;
  } catch {
    return STUN_ONLY;
  }
}
