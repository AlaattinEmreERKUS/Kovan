export interface Env {
  KOVAN: DurableObjectNamespace;
  /**
   * Yalnizca `npm run dev` icinde "1" olur (wrangler dev --var).
   * `wrangler deploy` bu degiskeni tanimlamaz, yani uretimde dev uclari
   * VARSAYILAN OLARAK KAPALIDIR. Plandaki hostname === "127.0.0.1" kontrolu
   * Host basligiyla taklit edilebilirdi ve davet kodu bu uygulamadaki tek
   * erisim kontrolu.
   */
  KOVAN_DEV?: string;
}

/**
 * Web istemcisi ayri kokende calisiyor (dev: 5173 vs 8787, uretimde Pages
 * alan adi vs worker alan adi). CORS basliklari olmadan tarayici /api
 * cagrilarini bloklar ve kullanici "Sunucuya ulasilamadi" gorur.
 *
 * `*` guvenli: kimlik dogrulama cerezle degil, gövdedeki/URL'deki token ile
 * yapiliyor, yani tarayici baska bir sitede oturum bilgisi tasimiyor.
 * WebSocket'ler CORS'a tabi degil.
 */
const CORS: Record<string, string> = {
  "access-control-allow-origin": "*",
  "access-control-allow-methods": "GET,POST,OPTIONS",
  "access-control-allow-headers": "content-type",
  "access-control-max-age": "86400",
};

function korsEkle(res: Response): Response {
  const kopya = new Response(res.body, res);
  for (const [k, v] of Object.entries(CORS)) kopya.headers.set(k, v);
  return kopya;
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);

    if (url.pathname === "/health") {
      return korsEkle(Response.json({ ok: true }));
    }

    if (request.method === "OPTIONS" && url.pathname.startsWith("/api/")) {
      return new Response(null, { status: 204, headers: CORS });
    }

    if (url.pathname.startsWith("/api/") || url.pathname === "/ws") {
      const id = env.KOVAN.idFromName("kovan-main");
      const res = await env.KOVAN.get(id).fetch(request);
      // 101 upgrade yanitinin govdesi/basligi kopyalanamaz, dokunma.
      return res.status === 101 ? res : korsEkle(res);
    }

    return new Response("not found", { status: 404 });
  },
};

export { KovanServer } from "./KovanServer";
