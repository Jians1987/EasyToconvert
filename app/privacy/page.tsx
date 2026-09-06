import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Privacy & Data Handling – EasyToConvert",
  description: "Where conversions run, what gets uploaded, and what stays in browser storage.",
};

export default function PrivacyPage() {
  return <article className="max-w-3xl mx-auto space-y-6 text-sm leading-relaxed">
    <h1 className="text-3xl font-bold">Privacy &amp; Data Handling</h1>
    <p>Most EasyToConvert tools process files in your browser. The following features use a server or an external provider when you run them.</p>
    <h2 className="text-xl font-semibold">Uploads and external processing</h2>
    <ul className="list-disc pl-6 space-y-2">
      <li>PDF compression uploads the complete PDF to our server for processing.</li>
      <li>Choosing Adobe export uploads your PDF through our server to Adobe PDF Services.</li>
      <li>Cloud OCR sends page images or detected table rows through our server to the configured OCR provider: Moonshot, Mistral, or an operator-hosted OCR service. Cloud OCR is disabled by default.</li>
      <li>AI summarization, translation and code explanation send submitted text to the configured Groq or NVIDIA service. Audio transcription sends your audio to Groq.</li>
      <li>The Mobil tool can publish data to Google Sheets when you connect your Google account and choose to publish.</li>
    </ul>
    <p>Our conversion routes process uploads without deliberately saving a permanent copy. External providers and hosting infrastructure have their own retention and logging practices; we cannot promise immediate deletion or zero retention by those services. Avoid submitting sensitive material unless those practices meet your needs.</p>
    <h2 className="text-xl font-semibold">Browser storage and network requests</h2>
    <p>Your browser stores theme preferences, favorites and conversion history, including filenames and, for some tools, output data. Clear history in My Activity, or clear this site’s browser data to remove all stored preferences and history. Local tools may download fonts, libraries or model files from external services; those requests expose normal connection information such as your IP address.</p>
    <h2 className="text-xl font-semibold">Operational information</h2>
    <p>Server logs include processing outcomes, sizes, timings and errors. Rate limiting uses a client identifier derived from your IP address, with temporary counters in our shared store. Server and cloud tools have usage limits.</p>
    <p>For questions, email <a className="underline" href="mailto:support@easytoconvert.in">support@easytoconvert.in</a>.</p>
  </article>;
}
