export class KovanServer implements DurableObject {
  constructor(private ctx: DurableObjectState, private env: unknown) {}

  async fetch(_request: Request): Promise<Response> {
    return new Response("not implemented", { status: 501 });
  }
}
