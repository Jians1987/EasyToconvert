// Pure post-processing for OCR model output. Split out of app/api/ai/route.ts
// so these can be unit-tested directly instead of only via a live vendor call
// (a real refusal or malformed fence is not something you can reliably force
// a cloud provider to produce on demand).
//
// Also contains conservative hallucination heuristics. These intentionally
// fire only on high-confidence anomalies — wrong guesses on a real invoice
// are far more harmful than missing a synthetic hallucination.

/** Strip a whole-output ``` fence the model sometimes adds despite instructions. */
export function stripOuterFence(text: string): string {
  const trimmed = text.trim();
  const fence = /^```(?:markdown|md|text)?\s*\n([\s\S]*?)\n```$/i.exec(trimmed);
  return (fence ? fence[1] : trimmed).trim();
}

/** Heuristic: did the model refuse ("I'm sorry…") instead of transcribing? */
export function looksLikeRefusal(text: string): boolean {
  return text.length < 400 && /\b(i'?m sorry|i can(?:no|')t|as an ai|unable to)\b/i.test(text);
}

/**
 * Heuristic: does this output look like a hallucination rather than a real
 * transcription?
 *
 * Two independent signals, either of which fires the flag:
 *
 *  1. Tiny-input / long-output ratio — a sub-5 KB image (32×32 to roughly
 *     80×80 pixels at typical document DPI) cannot contain thousands of
 *     characters of real content. Output that long from such a small image
 *     is almost certainly fabricated.
 *
 *  2. Pathological line-level repetition — >40 % of non-empty lines being
 *     identical indicates looping generation rather than genuine document
 *     content. (Requires at least 8 non-empty lines to reduce false positives
 *     on short but legitimate repeating structure like a simple two-column
 *     table.)
 *
 * The check is deliberately conservative: only fires on anomalies that are
 * implausible for real document content. Aggressive thresholds would falsely
 * flag dense spreadsheets or forms with many identical field labels.
 *
 * @param imageSizeBytes Decoded byte length of the image (NOT the base64 string).
 */
export function looksLikeHallucination(text: string, imageSizeBytes: number): boolean {
  if (!text || imageSizeBytes <= 0) return false;

  if (imageSizeBytes < 5_000 && text.length > 3_000) return true;

  const lines = text.split("\n").filter((l) => l.trim().length > 0);
  if (lines.length >= 8) {
    const counts = new Map<string, number>();
    for (const l of lines) counts.set(l, (counts.get(l) ?? 0) + 1);
    const maxCount = Math.max(...Array.from(counts.values()));
    if (maxCount / lines.length > 0.4) return true;
  }

  return false;
}

/** Is this line a GFM table separator row, e.g. "| --- | :---: |"? */
function isTableSeparatorRow(line: string): boolean {
  return /^\|?\s*:?-{2,}:?\s*(\|\s*:?-{2,}:?\s*)*\|?$/.test(line);
}

/**
 * Degrade Markdown to plain text. Only needed for providers whose API has no
 * native plain-text mode — Mistral OCR always returns Markdown regardless of
 * what's asked for — so "basic" mode stays a true cross-provider contract
 * (no markdown syntax) instead of silently varying by which backend ran.
 *
 * Deliberately not a full CommonMark parser: strips headings, table pipes,
 * and bold markers; leaves list markers and single-emphasis markers alone
 * since they read fine as plain text and the ambiguity with a leading "*"
 * bullet isn't worth resolving for this use case.
 */
export function stripMarkdownSyntax(markdown: string): string {
  const out: string[] = [];

  for (const rawLine of markdown.split("\n")) {
    const line = rawLine.trim();
    if (isTableSeparatorRow(line)) continue; // carries no text, drop entirely

    let text = line.replace(/^#{1,6}\s+/, "");

    if (text.includes("|")) {
      text = text
        .split("|")
        .map((cell) => cell.trim())
        .filter((cell) => cell.length > 0)
        .join("  ");
    }

    text = text.replace(/\*\*(.+?)\*\*/g, "$1");
    out.push(text);
  }

  return out.join("\n").replace(/\n{3,}/g, "\n\n").trim();
}
