import { NextResponse } from "next/server";
import nodemailer from "nodemailer";

export const runtime = "nodejs";
export const maxDuration = 30;

const MAX_NAME = 100;
const MAX_EMAIL = 254;
const MAX_MESSAGE = 5_000;

// Deliberately strict: anything that reaches a mail header must not be able to
// contain CR/LF, or a sender could inject extra headers (Bcc, Reply-To, …).
const EMAIL_RE = /^[^\s@<>,;:"'\\]+@[^\s@<>,;:"'\\]+\.[^\s@<>,;:"'\\]{2,}$/;

/** Strip anything that could break out of a header value. */
function headerSafe(value: string): string {
  return value.replace(/[\r\n\t]/g, " ").trim();
}

// Per-IP throttle. In-memory, so it resets on cold start and is per-instance
// rather than global — it stops casual flooding, not a distributed attack.
// Move to a shared store (Upstash/Redis) if this endpoint gets abused.
const WINDOW_MS = 60 * 60 * 1000; // 1 hour
const MAX_PER_WINDOW = 5;
const hits = new Map<string, number[]>();

function rateLimited(ip: string): boolean {
  const now = Date.now();
  const cutoff = now - WINDOW_MS;

  // Prune while we're here so the map cannot grow without bound.
  hits.forEach((times: number[], key: string) => {
    const kept = times.filter((t: number) => t > cutoff);
    if (kept.length) hits.set(key, kept);
    else hits.delete(key);
  });

  const recent = hits.get(ip) ?? [];
  if (recent.length >= MAX_PER_WINDOW) return true;

  hits.set(ip, [...recent, now]);
  return false;
}

function clientIp(req: Request): string {
  const forwarded = req.headers.get("x-forwarded-for");
  if (forwarded) return forwarded.split(",")[0].trim();
  return req.headers.get("x-real-ip")?.trim() || "unknown";
}

export async function POST(req: Request) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }

  if (!body || typeof body !== "object") {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }

  const { name, email, message, website } = body as Record<string, unknown>;

  // Honeypot: real people never see this field, bots fill everything in.
  // Return a normal success so the bot has nothing to learn from the response.
  if (typeof website === "string" && website.trim() !== "") {
    return NextResponse.json({ ok: true });
  }

  if (typeof name !== "string" || !name.trim()) {
    return NextResponse.json({ error: "Please enter your name." }, { status: 400 });
  }
  if (typeof email !== "string" || !EMAIL_RE.test(email.trim())) {
    return NextResponse.json({ error: "Please enter a valid email address." }, { status: 400 });
  }
  if (typeof message !== "string" || !message.trim()) {
    return NextResponse.json({ error: "Please enter a message." }, { status: 400 });
  }
  if (name.length > MAX_NAME || email.length > MAX_EMAIL || message.length > MAX_MESSAGE) {
    return NextResponse.json(
      { error: `Message is too long. Keep it under ${MAX_MESSAGE} characters.` },
      { status: 413 }
    );
  }

  if (rateLimited(clientIp(req))) {
    return NextResponse.json(
      { error: "Too many messages sent from this address. Please try again later." },
      { status: 429 }
    );
  }

  const host = process.env.SMTP_HOST;
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;
  const to = process.env.CONTACT_TO_EMAIL || "support@easytoconvert.in";
  const from = process.env.CONTACT_FROM_EMAIL || user;

  if (!host || !user || !pass || !from) {
    console.error("Contact form is not configured: missing SMTP_HOST/SMTP_USER/SMTP_PASS.");
    return NextResponse.json(
      { error: "The contact form is not configured right now. Please email us directly." },
      { status: 503 }
    );
  }

  const port = Number(process.env.SMTP_PORT || 587);
  const cleanName = headerSafe(name);
  const cleanEmail = headerSafe(email);

  try {
    const transporter = nodemailer.createTransport({
      host,
      port,
      secure: port === 465, // 465 = implicit TLS; 587 upgrades via STARTTLS
      auth: { user, pass },
    });

    await transporter.sendMail({
      // Must send as our own domain — putting the visitor's address in `from`
      // fails SPF/DKIM and gets the mail spam-filtered. Their address goes in
      // replyTo so hitting reply still works.
      from: `"EasyToConvert Contact" <${from}>`,
      to,
      replyTo: `"${cleanName.replace(/"/g, "")}" <${cleanEmail}>`,
      subject: `Contact form: ${cleanName}`,
      text: `From: ${cleanName} <${cleanEmail}>\n\n${message.trim()}`,
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    // Log the real reason server-side; don't leak SMTP details to the client.
    console.error("Contact form send failed:", error);
    return NextResponse.json(
      { error: "We couldn't send your message. Please email us directly instead." },
      { status: 502 }
    );
  }
}
