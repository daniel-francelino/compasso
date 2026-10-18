import { defineConfig } from "@playwright/test";

const PORT = 5199;

export default defineConfig({
  testDir: "e2e",
  fullyParallel: true,
  reporter: "list",
  use: { baseURL: `http://localhost:${PORT}` },
  webServer: {
    command: `npx vite dev --port ${PORT} --strictPort`,
    url: `http://localhost:${PORT}`,
    reuseExistingServer: true,
    timeout: 120_000,
    env: {
      VITE_SUPABASE_URL: process.env["VITE_SUPABASE_URL"] ?? "http://127.0.0.1:54321",
      VITE_SUPABASE_PUBLISHABLE_KEY:
        process.env["VITE_SUPABASE_PUBLISHABLE_KEY"] ?? "e2e-placeholder",
    },
  },
});
