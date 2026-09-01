import { env, runInDurableObject } from "cloudflare:test";
import { describe, it, expect } from "vitest";
import { ensureSchema } from "../src/schema";

describe("schema", () => {
  it("tum tablolari kurar ve iki kez cagrilinca patlamaz", async () => {
    const id = env.KOVAN.idFromName("schema-test");
    const stub = env.KOVAN.get(id);

    await runInDurableObject(stub, (_instance, state) => {
      ensureSchema(state.storage.sql);
      ensureSchema(state.storage.sql); // idempotent olmali

      const tables = state.storage.sql
        .exec<{ name: string }>("SELECT name FROM sqlite_master WHERE type='table'")
        .toArray()
        .map((r) => r.name);

      expect(tables).toEqual(
        expect.arrayContaining(["users", "invites", "sessions", "messages", "reactions"])
      );
    });
  });
});
