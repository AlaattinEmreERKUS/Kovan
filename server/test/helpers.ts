import { env, runInDurableObject } from "cloudflare:test";
import { writeState } from "../src/sockets";
import type { ServerEvent } from "@shared/protocol";

const BASE = "https://kovan.test";

export const stub = () => env.KOVAN.get(env.KOVAN.idFromName("kovan-main"));

/**
 * Tüm tabloları boşaltır, ACIK SOCKET'LERI KAPATIR ve davet kodlarını ekler.
 * Testler tek bir DO örneğini paylaşır: socket'ler kapatılmazsa bir testin
 * bağlantısı sonraki testte getWebSockets() içinde durmaya devam eder.
 */
export async function reset(codes: string[] = ["A1", "A2"]): Promise<void> {
  await runInDurableObject(stub(), (_i, state) => {
    for (const ws of state.getWebSockets()) {
      // Once sesten dusur, sonra kapat. Kapanis isleyicisi seste olan bir
      // socket icin voice.members yayinlar; bu yayin gecikmeli calisip bir
      // SONRAKI testin kuyruguna bayat liste dusuruyordu.
      writeState(ws, { inVoice: false });
      ws.close(1000, "test reset");
    }
    for (const t of ["users", "invites", "sessions", "messages", "reactions"]) {
      state.storage.sql.exec(`DELETE FROM ${t}`);
    }
    for (const c of codes) {
      state.storage.sql.exec("INSERT INTO invites (code) VALUES (?)", c);
    }
  });

  // Kapanis isleyicileri ASENKRON calisir: reset dondukten sonra tetiklenen
  // bir webSocketClose, bir SONRAKI testin taze socketine presence.update ya
  // da voice.members dusuruyordu ve bekle() bayat olayi yakaliyordu.
  // Socketler gercekten gidene kadar bekle.
  for (let i = 0; i < 100; i++) {
    const kalan = await runInDurableObject(stub(), (_i, state) => state.getWebSockets().length);
    if (kalan === 0) return;
    await new Promise((r) => setTimeout(r, 10));
  }
  throw new Error("reset(): socketler kapanmadi");
}

export async function kayit(code: string, username: string): Promise<string> {
  const res = await stub().fetch(`${BASE}/api/register`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ code, username, displayName: username, password: "kovan123" }),
  });
  return (await res.json<{ token: string }>()).token;
}

/**
 * Gelen olaylar accept() anindan itibaren kuyruga alinir. Sunucu `hello`yi
 * baglantidan hemen sonra gonderir; testin dinleyiciyi baglamasini beklemez.
 * Kuyruk olmadan araya giren bir await (ornegin ikinci kayit'in PBKDF2'si)
 * o olayi kaybettiriyordu.
 */
const kuyruklar = new WeakMap<WebSocket, ServerEvent[]>();

export async function baglan(token: string): Promise<WebSocket> {
  const res = await stub().fetch(`${BASE}/ws?token=${token}`, {
    headers: { Upgrade: "websocket" },
  });
  const ws = res.webSocket!;
  ws.accept();
  const kuyruk: ServerEvent[] = [];
  kuyruklar.set(ws, kuyruk);
  ws.addEventListener("message", (e) => {
    kuyruk.push(JSON.parse(e.data as string) as ServerEvent);
  });
  return ws;
}

/** Belirtilen tipte ilk olayı kuyruktan alır, 2 saniyede gelmezse hata fırlatır. */
export function bekle<T extends ServerEvent["t"]>(
  ws: WebSocket, tip: T
): Promise<Extract<ServerEvent, { t: T }>> {
  const kuyruk = kuyruklar.get(ws);
  if (!kuyruk) throw new Error("bekle(): socket baglan() ile acilmali");

  const al = (): Extract<ServerEvent, { t: T }> | undefined => {
    const i = kuyruk.findIndex((o) => o.t === tip);
    return i < 0 ? undefined : (kuyruk.splice(i, 1)[0] as Extract<ServerEvent, { t: T }>);
  };

  const hazir = al();
  if (hazir) return Promise.resolve(hazir);

  return new Promise((resolve, reject) => {
    const zamanlayici = setTimeout(() => {
      ws.removeEventListener("message", dinleyici);
      reject(new Error(`${tip} gelmedi`));
    }, 2000);
    const dinleyici = () => {
      const olay = al();
      if (!olay) return;
      clearTimeout(zamanlayici);
      ws.removeEventListener("message", dinleyici);
      resolve(olay);
    };
    ws.addEventListener("message", dinleyici);
  });
}
