export interface Env {
  KOVAN: DurableObjectNamespace;
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);

    if (url.pathname === "/health") {
      return Response.json({ ok: true });
    }

    if (url.pathname.startsWith("/api/") || url.pathname === "/ws") {
      const id = env.KOVAN.idFromName("kovan-main");
      return env.KOVAN.get(id).fetch(request);
    }

    return new Response("not found", { status: 404 });
  },
};

export { KovanServer } from "./KovanServer";
