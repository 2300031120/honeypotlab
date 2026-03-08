import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "jsdom",
    setupFiles: ["./src/test/setupTests.js"],
    include: ["src/**/*.test.{js,jsx,ts,tsx}"],
    globals: true,
    css: false,
  },
});

