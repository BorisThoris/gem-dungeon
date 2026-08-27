import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    include: ["src/**/*.test.{ts,tsx}"],
    maxWorkers: 2,
    passWithNoTests: false,
    testTimeout: 15_000,
  },
});
