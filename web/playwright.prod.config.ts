import { defineConfig } from "@playwright/test";

// Canli duman testi: yerel sunucu baslatmaz, dogrudan uretime bakar.
export default defineConfig({
  testDir: "./e2e",
  testMatch: /prod-(smoke|voice-smoke)\.spec\.ts/,
  timeout: 60_000,
  use: { baseURL: "https://kovan-web.pages.dev" },
});
