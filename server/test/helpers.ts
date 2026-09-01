import { env, runInDurableObject } from "cloudflare:test";
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
      ws.close(1000, "test reset");
    }
    for (const t of ["users", "invites", "sessions", "messages", "reactions"]) {
      state.storage.sql.exec(`DELETE FROM ${t}`);
    }
    for (const c of codes) {
      state.storage.sql.exec("INSERT INTO invites (code) VALUES (?)", c);
    }
  });
}

export async function kayit(code: string, username: string): Promise<string> {
  const res = await stub().fetch(`${BASE}/api/register`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ code, username, displayName: username, password: "kovan123" }),
  });
  return (await res.json<{ token: string }>()).token;
}

export async function baglan(token: string): Promise<WebSocket> {
  const res = await stub().fetch(`${BASE}/ws?token=${token}`, {
    headers: { Upgrade: "websocket" },
  });
  const ws = res.webSocket!;
  ws.accept();
  return ws;
}

/** Belirtilen tipte ilk olayı bekler, 2 saniyede gelmezse hata fırlatır. */
export function bekle<T extends ServerEvent["t"]>(
  ws: WebSocket, tip: T
): Promise<Extract<ServerEvent, { t: T }>> {
  return new Promise((resolve, reject) => {
    const zamanlayici = setTimeout(() => reject(new Error(`${tip} gelmedi`)), 2000);
    const dinleyici = (e: MessageEvent) => {
      const olay = JSON.parse(e.data as string) as ServerEvent;
      if (olay.t === tip) {
        clearTimeout(zamanlayici);
        ws.removeEventListener("message", dinleyici);
        resolve(olay as Extract<ServerEvent, { t: T }>);
      }
    };
    ws.addEventListener("message", dinleyici);
  });
}
