// Client for the server-side /api/ai proxy. Turns proxy failures into messages
// that make sense to a visitor instead of raw status codes and JSON bodies.

const STATUS_MESSAGES: Record<number, string> = {
  413: "This file is too large for the cloud AI service. Try a smaller file or fewer pages.",
  429: "The cloud AI service is busy right now. Please wait a moment and try again.",
  502: "The cloud AI provider didn't respond correctly. Please try again in a moment.",
  503: "Cloud AI features aren't available on this server right now. On-device tools still work.",
  504: "The cloud AI service took too long to respond. Please try again.",
};

export async function postAi<T = any>(body: Record<string, unknown>): Promise<T> {
  let res: Response;
  try {
    res = await fetch("/api/ai", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
  } catch {
    throw new Error("Couldn't reach the cloud AI service. Check your internet connection and try again.");
  }
  if (!res.ok) {
    const detail = await res.json().then((d) => d?.error).catch(() => undefined);
    throw new Error(STATUS_MESSAGES[res.status] ?? (typeof detail === "string" ? detail : `Cloud AI request failed (${res.status}).`));
  }
  return res.json();
}
