import { test, expect } from "@playwright/test";
import { readFileSync } from "node:fs";

const API = "https://kovan.emrerkus23.workers.dev";
// Anahtar depoda degil; .admin-key gitignore'da.
const ADMIN = readFileSync(new URL("../../.admin-key", import.meta.url), "utf8").trim();

test("canli: kayit, mesaj gonderme ve yenileme sonrasi kalicilik", async ({ page }) => {
  const damga = Date.now();
  const kod = `SMOKE-${damga}`;

  const davet = await fetch(`${API}/api/admin/invite`, {
    method: "POST",
    headers: { "content-type": "application/json", "x-admin": ADMIN },
    body: JSON.stringify({ code: kod }),
  });
  expect(davet.ok).toBeTruthy();

  await page.goto("/giris");
  await page.getByRole("button", { name: /Kayıt ol$/ }).click();
  await page.getByPlaceholder("Davet kodu").fill(kod);
  await page.getByPlaceholder("Görünen ad").fill(`Duman${damga}`);
  await page.getByPlaceholder("Kullanıcı adı").fill(`duman${damga}`);
  await page.getByPlaceholder("Parola").fill("kovan123");
  await page.getByRole("button", { name: "Kayıt ol" }).click();

  await expect(page.getByRole("log")).toBeVisible();

  const mesaj = `canli duman ${damga}`;
  await page.getByLabel("Mesaj yaz").fill(mesaj);
  await page.getByLabel("Mesaj yaz").press("Enter");
  await expect(page.getByText(mesaj)).toBeVisible();

  // Kalicilik: sayfa yenilenince mesaj DO SQLite'tan geri gelmeli.
  await page.reload();
  await expect(page.getByText(mesaj)).toBeVisible();
});
