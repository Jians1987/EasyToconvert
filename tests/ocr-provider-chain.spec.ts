import { test, expect } from "@playwright/test";
import { resolveOcrChain } from "../app/lib/ocrProviderChain";

// This suite runs with workers: 1, so test files can share a single Node
// process/module cache. Mutating process.env here without restoring it would
// leak into unrelated tests (or real route calls) later in the same run —
// every test that touches these vars restores them in afterEach.
test.describe("resolveOcrChain", () => {
  const ORIGINAL_KIMI_KEY = process.env.KIMI_API_KEY;
  const ORIGINAL_OCR_PROVIDER = process.env.OCR_PROVIDER;

  test.afterEach(() => {
    if (ORIGINAL_KIMI_KEY === undefined) delete process.env.KIMI_API_KEY;
    else process.env.KIMI_API_KEY = ORIGINAL_KIMI_KEY;
    if (ORIGINAL_OCR_PROVIDER === undefined) delete process.env.OCR_PROVIDER;
    else process.env.OCR_PROVIDER = ORIGINAL_OCR_PROVIDER;
  });

  test("explicit provider:\"mistral\" pins the chain to mistral alone", () => {
    expect(resolveOcrChain("mistral")).toEqual(["mistral"]);
  });

  test("OCR_PROVIDER=mistral pins the chain the same way", () => {
    delete process.env.OCR_PROVIDER;
    process.env.OCR_PROVIDER = "mistral";
    expect(resolveOcrChain(undefined)).toEqual(["mistral"]);
  });

  test("an explicit provider param overrides OCR_PROVIDER", () => {
    process.env.OCR_PROVIDER = "local";
    expect(resolveOcrChain("mistral")).toEqual(["mistral"]);
  });

  // The whole point of adding Mistral behind a pin rather than to the default
  // chain: it must not appear here even when Kimi IS configured, until it's
  // been A/B tested against Kimi on real documents.
  test("the default auto chain never includes mistral, even when Kimi is configured", () => {
    delete process.env.OCR_PROVIDER;
    process.env.KIMI_API_KEY = "test-key-value";
    expect(resolveOcrChain(undefined)).toEqual(["kimi", "local"]);
  });

  test("the default auto chain falls straight to local when no Kimi key is set", () => {
    delete process.env.OCR_PROVIDER;
    delete process.env.KIMI_API_KEY;
    expect(resolveOcrChain(undefined)).toEqual(["local"]);
  });

  test("pinning kimi/local behaves exactly as before adding mistral", () => {
    expect(resolveOcrChain("kimi")).toEqual(["kimi"]);
    expect(resolveOcrChain("local")).toEqual(["local"]);
  });

  test("an unrecognised provider value falls through to the default auto chain", () => {
    delete process.env.OCR_PROVIDER;
    process.env.KIMI_API_KEY = "test-key-value";
    expect(resolveOcrChain("not-a-real-provider")).toEqual(["kimi", "local"]);
  });
});
