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

async function postRaw(path: string, rawBody: string) {
  return stub().fetch(`${BASE}${path}`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: rawBody,
  });
}

async function countUsers(): Promise<number> {
  let count = 0;
  await runInDurableObject(stub(), (_i, state) => {
    const row = state.storage.sql.exec("SELECT COUNT(*) as c FROM users").toArray()[0] as { c: number };
    count = row.c;
  });
  return count;
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
    const ilk = await post("/api/register", { code: "A1", username: "napol", displayName: "N", password: "kovan123" });
    expect(ilk.status).toBe(201);
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

  it("bozuk json govdesi 400 doner", async () => {
    const res = await postRaw("/api/register", "{ bu gecerli json degil");
    expect(res.status).toBe(400);
  });

  it("nesne olmayan ama gecerli json govde 400 doner", async () => {
    // "null" gecerli JSON'dur; destructure edilirse istek yanitsiz duser.
    for (const ham of ["null", '"metin"', "42", "[]"]) {
      expect((await postRaw("/api/register", ham)).status, ham).toBe(400);
      expect((await postRaw("/api/login", ham)).status, ham).toBe(400);
    }
  });

  it("asiri uzun kullanici adi ve gorunen ad 400 doner", async () => {
    await seedInvite("A1");
    const uzunKullanici = await post("/api/register", {
      code: "A1", username: "a".repeat(33), displayName: "N", password: "kovan123",
    });
    expect(uzunKullanici.status).toBe(400);
    const uzunAd = await post("/api/register", {
      code: "A1", username: "napol", displayName: "b".repeat(65), password: "kovan123",
    });
    expect(uzunAd.status).toBe(400);
  });

  it("string olmayan alan 400 doner", async () => {
    await seedInvite("A1");
    const res = await post("/api/register", {
      code: "A1", username: { hack: true }, displayName: "N", password: "kovan123",
    });
    expect(res.status).toBe(400);
  });

  it("256 karakterden uzun parola 400 doner", async () => {
    await seedInvite("A1");
    const uzunParola = "a".repeat(257);
    const res = await post("/api/register", {
      code: "A1", username: "napol", displayName: "N", password: uzunParola,
    });
    expect(res.status).toBe(400);
    const body = await res.json<{ code: string }>();
    expect(body.code).toBe("uzun_parola");
  });

  it("ayni davet kodu iki es zamanli istekte yalnizca birine verilir", async () => {
    await seedInvite("RACE1");

    const [a, b] = await Promise.all([
      post("/api/register", { code: "RACE1", username: "yaris-a", displayName: "A", password: "kovan123" }),
      post("/api/register", { code: "RACE1", username: "yaris-b", displayName: "B", password: "kovan123" }),
    ]);

    const statuses = [a.status, b.status].sort();
    expect(statuses).toEqual([201, 403]);
    expect(await countUsers()).toBe(1);
  });
});
