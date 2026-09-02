import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "./e2e",
  // Canli duman testi ayri config ile kosulur (playwright.prod.config.ts).
  testIgnore: /prod-smoke\.spec\.ts/,
  timeout: 30_000,
  use: {
    baseURL: "http://127.0.0.1:5173",
    permissions: ["microphone", "camera"],
    launchOptions: {
      args: [
        // Gercek mikrofon yok: Chromium sabit bir ton uretir, bu yuzden karsi
        // tarafta RMS olcumu anlamli olur.
        "--use-fake-device-for-media-stream",
        "--use-fake-ui-for-media-stream",
        "--autoplay-policy=no-user-gesture-required",
      ],
    },
  },
  webServer: [
    // --host 127.0.0.1 sart: vite varsayilan olarak "localhost"a baglaniyor,
    // Windows'ta bu yalnizca ::1 demek ve 127.0.0.1 beklemesi zaman asimina
    // ugruyor.
    { command: "npm run dev -- --port 5173 --host 127.0.0.1", url: "http://127.0.0.1:5173", reuseExistingServer: true },
    { command: "npm --prefix ../server run dev", url: "http://127.0.0.1:8787/health", reuseExistingServer: true },
  ],
});
