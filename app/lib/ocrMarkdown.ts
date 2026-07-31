// Pure post-processing for OCR model output. Split out of app/api/ai/route.ts
// so these can be unit-tested directly instead of only via a live vendor call
// (a real refusal or malformed fence is not something you can reliably force
// a cloud provider to produce on demand).

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
