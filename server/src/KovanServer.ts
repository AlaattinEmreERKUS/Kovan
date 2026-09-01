import { ensureSchema } from "./schema";

export class KovanServer implements DurableObject {
  constructor(private ctx: DurableObjectState, private env: unknown) {
    ensureSchema(ctx.storage.sql);
  }

  async fetch(_request: Request): Promise<Response> {
    return new Response("not implemented", { status: 501 });
  }
}
