import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    tsconfigPaths: true,
  },
  test: {
    environment: "node",
    include: ["src/**/*.test.ts"],
    // expectTypeOf assertions are no-ops at runtime; typecheck mode makes
    // `pnpm test` fail on them too (not only `pnpm typecheck`).
    typecheck: {
      enabled: true,
      include: ["src/**/*.test.ts"],
      tsconfig: "./tsconfig.json",
    },
  },
});
