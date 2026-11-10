import { fileURLToPath } from "node:url";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vitest/config";

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) },
  },
  test: {
    environment: "jsdom",
    setupFiles: ["./src/test/setup.ts"],
    include: ["src/**/*.test.{ts,tsx}"],
    restoreMocks: true,
    unstubGlobals: true,
    // jsdom 环境里 import.meta.url 不是 file: 地址，夹具目录在这里（Node 环境）算好再传进去
    env: { VERIFY_FIXTURE_DIR: fileURLToPath(new URL("../verify/fixtures/", import.meta.url)) },
  },
});
