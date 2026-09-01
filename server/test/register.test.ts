import { env, runInDurableObject } from "cloudflare:test";
import { describe, it, expect, beforeEach } from "vitest";

const BASE = "https://kovan.test";

function stub() {
  return env.KOVAN.get(env.KOVAN.idFromName("kovan-main"));
}

async function seedInvite(code: string) {
  await runInDurableObject(stub(), (_i, state) => {
    state.storage.sql.exec("INSERT OR REPLACE INTO invites (code) VALUES (?)", code);
  });
}

async function post(path: string, body: unknown) {
  return stub().fetch(`${BASE}${path}`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("kayit ve giris", () => {
  beforeEach(async () => {
    await runInDurableObject(stub(), (_i, state) => {
      state.storage.sql.exec("DELETE FROM users");
      state.storage.sql.exec("DELETE FROM invites");
      state.storage.sql.exec("DELETE FROM sessions");
    });
  });

  it("gecersiz davet kodu 403 doner", async () => {
    const res = await post("/api/register", {
      code: "yok", username: "napol", displayName: "Napol", password: "kovan123",
    });
    expect(res.status).toBe(403);
  });

  it("gecerli kod ile kayit token doner ve kodu tuketir", async () => {
    await seedInvite("ABC123");

    const res = await post("/api/register", {
      code: "ABC123", username: "napol", displayName: "Napol", password: "kovan123",
    });
    expect(res.status).toBe(201);

    const body = await res.json<{ token: string; user: { username: string } }>();
    expect(body.token).toMatch(/^[0-9a-f]{64}$/);
    expect(body.user.username).toBe("napol");

    // ayni kod ikinci kez kullanilamaz
    const ikinci = await post("/api/register", {
      code: "ABC123", username: "denis", displayName: "Denis", password: "kovan123",
    });
    expect(ikinci.status).toBe(403);
  });

  it("ayni kullanici adi ikinci kez alinamaz", async () => {
    await seedInvite("A1");
    await seedInvite("A2");
    await post("/api/register", { code: "A1", username: "napol", displayName: "N", password: "kovan123" });
    const res = await post("/api/register", { code: "A2", username: "napol", displayName: "N", password: "kovan123" });
    expect(res.status).toBe(409);
  });

  it("dogru parola ile giris token doner, yanlis parola 401", async () => {
    await seedInvite("A1");
    await post("/api/register", { code: "A1", username: "napol", displayName: "N", password: "kovan123" });

    const ok = await post("/api/login", { username: "napol", password: "kovan123" });
    expect(ok.status).toBe(200);

    const kotu = await post("/api/login", { username: "napol", password: "yanlis" });
    expect(kotu.status).toBe(401);
  });

  it("olmayan kullanici da 401 doner", async () => {
    const res = await post("/api/login", { username: "hayalet", password: "x" });
    expect(res.status).toBe(401);
  });
});
