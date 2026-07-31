import { test, expect } from "@playwright/test";
import { stripOuterFence, looksLikeRefusal } from "../app/lib/ocrMarkdown";

// These cover cases that are impractical to force from a live vendor on
// demand (a real refusal, a malformed fence) — direct unit coverage instead.
test.describe("stripOuterFence", () => {
  test("removes a ```markdown fence wrapping the whole response", () => {
    const wrapped = "```markdown\n# Heading\n\nBody text\n```";
    expect(stripOuterFence(wrapped)).toBe("# Heading\n\nBody text");
  });

  test("removes a bare ``` fence with no language tag", () => {
    expect(stripOuterFence("```\nplain text\n```")).toBe("plain text");
  });

  test("leaves unfenced output untouched", () => {
    expect(stripOuterFence("# Heading\n\nBody text")).toBe("# Heading\n\nBody text");
  });

  test("does not strip a fence that is only part of the output (a real code block)", () => {
    const withEmbeddedCode = "# Notes\n\n```js\nconst x = 1;\n```\n\nMore text after.";
    expect(stripOuterFence(withEmbeddedCode)).toBe(withEmbeddedCode);
  });
});

test.describe("looksLikeRefusal", () => {
  test("flags a short refusal-shaped response", () => {
    expect(looksLikeRefusal("I'm sorry, but I can't help with that request.")).toBe(true);
    expect(looksLikeRefusal("As an AI, I am unable to process this image.")).toBe(true);
  });

  test("does not flag a normal transcription, even a long one", () => {
    const transcription = "# Invoice #4471\n\nTotal Due: $128.50\n\nDue Date: 2026-08-15".repeat(10);
    expect(looksLikeRefusal(transcription)).toBe(false);
  });

  test("does not flag real document text that happens to contain 'sorry'", () => {
    // A long real document mentioning "sorry" (e.g. an apology letter) is not a
    // refusal — length is part of the heuristic specifically to avoid this.
    const longDoc = "Dear customer, we are sorry for the delay. " + "Lorem ipsum dolor sit amet. ".repeat(20);
    expect(looksLikeRefusal(longDoc)).toBe(false);
  });
});
