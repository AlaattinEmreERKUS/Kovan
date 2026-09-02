import type { Handle } from "@sveltejs/kit";

/**
 * HTML her acilista DOGRULANIR.
 *
 * Sayfayi adaptorun Worker'i uretiyor, yani `_headers` dosyasi ona
 * ISLEMIYOR (o yalniz statik dosyalar icin). Basliksiz kalinca tarayici
 * eski index.html'i tutuyor, o da eski `_app/immutable/...` chunk'larini
 * cagiriyordu: deploy edilen surum asil adreste gorunmuyor, deploya ozel
 * adreste (ayri origin, bos onbellek) gorunuyordu. Iki tur boyunca
 * "duzeltmeler gelmemis" denmesinin sebebi buydu.
 *
 * Hash'li varliklara DOKUNULMAZ: onlar `_headers` uzerinden bir yil
 * immutable kalir.
 */
export const handle: Handle = async ({ event, resolve }) => {
  const res = await resolve(event);
  if (res.headers.get("content-type")?.startsWith("text/html")) {
    res.headers.set("cache-control", "no-cache");
  }
  return res;
};
