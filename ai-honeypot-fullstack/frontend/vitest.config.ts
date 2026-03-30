import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "jsdom",
    setupFiles: ["./src/test/setupTests.ts"],
    include: ["src/**/*.test.{js,jsx,ts,tsx}"],
    globals: true,
    css: false,
    testTimeout: 10000,
    hookTimeout: 10000,
    fileParallelism: false,
  },
});

