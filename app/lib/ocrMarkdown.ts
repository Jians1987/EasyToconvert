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
