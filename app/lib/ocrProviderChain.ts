// Server-only: decides which OCR backend(s) a request should try, and in what
// order. Split out of app/api/ai/route.ts so this decision is unit-testable
// directly — it is the one piece of logic that determines whether a new
// provider silently joins the default fallback chain, which is exactly the
// kind of thing that should be protected by a test, not just inspection.
//
// Reads server-only env vars (API keys) — never import this from client code.

export type OcrProviderId = "kimi" | "local" | "mistral";

/**
 * Ordered provider chain. `requested` (the client's `provider` param) or
 * OCR_PROVIDER (operator override) pins the chain to exactly one backend.
 *
 * Without a pin: Kimi first when configured, then the local self-hosted model
 * as a fallback. Mistral is deliberately NOT part of this default chain —
 * it's reachable only by explicit pin (provider: "mistral" or
 * OCR_PROVIDER=mistral) until it has been A/B tested against Kimi on real
 * documents. Don't add it to the default chain as a "nicer" fallback without
 * first updating this comment to say the test happened.
 */
export function resolveOcrChain(requested?: string): OcrProviderId[] {
  const pin = (requested || process.env.OCR_PROVIDER || "").trim().toLowerCase();
  if (pin === "kimi") return ["kimi"];
  if (pin === "local") return ["local"];
  if (pin === "mistral") return ["mistral"];

  const chain: OcrProviderId[] = [];
  if (process.env.MOONSHOT_API_KEY) chain.push("kimi");
  chain.push("local"); // always a fallback target (may be offline in prod)
  return chain;
}
