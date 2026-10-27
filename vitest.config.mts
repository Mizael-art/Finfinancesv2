import path from "node:path";
import { defineConfig } from "vitest/config";

process.env.TZ = "America/Sao_Paulo";

export default defineConfig({
  resolve: { alias: { "@": path.resolve(__dirname) } },
  test: {
    environment: "node",
    setupFiles: ["fake-indexeddb/auto"],
    include: ["**/*.test.ts"],
    exclude: ["node_modules/**", ".next/**"],
  },
});
