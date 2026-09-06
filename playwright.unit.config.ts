import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "./tests",
  testMatch: ["launch-regressions.spec.ts", "transcription.spec.ts", "image-validation.spec.ts", "ocr-markdown.spec.ts", "ocr-provider-chain.spec.ts", "pdf-to-markdown.spec.ts"],
  workers: 1,
  reporter: "list",
});
