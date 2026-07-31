import { test, expect } from "@playwright/test";
import { stripOuterFence, looksLikeRefusal, stripMarkdownSyntax } from "../app/lib/ocrMarkdown";

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

// Mistral OCR has no native plain-text mode — it always returns Markdown — so
// "basic" mode degrades its output through this function. It must actually
// strip markdown syntax, not just pass text through, or basic mode would
// silently vary in shape depending on which provider served the request.
test.describe("stripMarkdownSyntax", () => {
  test("removes heading markers", () => {
    expect(stripMarkdownSyntax("## Invoice #4471")).toBe("Invoice #4471");
  });

  test("removes bold markers but leaves the text", () => {
    expect(stripMarkdownSyntax("**Total Due:** $128.50")).toBe("Total Due: $128.50");
  });

  test("flattens a GFM table into space-separated cells and drops the separator row", () => {
    const table = "| Name | Price |\n| --- | --- |\n| Widget | $5 |\n| Gadget | $10 |";
    expect(stripMarkdownSyntax(table)).toBe("Name  Price\nWidget  $5\nGadget  $10");
  });

  test("drops separator rows with alignment colons", () => {
    const table = "| A | B |\n| :--- | ---: |\n| x | y |";
    expect(stripMarkdownSyntax(table)).toBe("A  B\nx  y");
  });

  test("leaves list markers alone", () => {
    expect(stripMarkdownSyntax("- First item\n- Second item")).toBe("- First item\n- Second item");
  });

  test("collapses excess blank lines but preserves paragraph breaks", () => {
    expect(stripMarkdownSyntax("# Title\n\n\n\nBody text")).toBe("Title\n\nBody text");
  });

  test("passes plain text through unchanged", () => {
    expect(stripMarkdownSyntax("Plain text mode test\nSecond line of content")).toBe(
      "Plain text mode test\nSecond line of content"
    );
  });
});
