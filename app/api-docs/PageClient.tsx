"use client";

import React, { useState } from "react";
import Link from "next/link";
import { Terminal, Copy, Check, Globe, Database, ArrowRight, AlertTriangle } from "lucide-react";

const BASE_URL = "https://www.easytoconvert.in";

type Language = "curl" | "node" | "python";

interface Endpoint {
  id: string;
  method: "POST";
  path: string;
  description: string;
  response: string;
  params: { name: string; type: string; required: boolean; desc: string }[];
  snippets: Record<Language, string>;
}

const endpoints: Endpoint[] = [
  {
    id: "compress",
    method: "POST",
    path: "/api/v1/image/compress",
    description: "Compresses a PNG, JPEG, WebP or AVIF image, optionally converting it to another format. EXIF orientation is applied and metadata (including GPS) is stripped.",
    response: "The image file. Headers X-Original-Size and X-Output-Size report the byte sizes; if re-encoding would make the file larger, the original is returned with X-Compression: original-kept.",
    params: [
      { name: "file", type: "file", required: true, desc: "PNG, JPEG, WebP or AVIF image." },
      { name: "quality", type: "integer", required: false, desc: "1 to 100. Default: 80." },
      { name: "format", type: "string", required: false, desc: "original (default), jpeg, png, webp or avif." },
    ],
    snippets: {
      curl: `curl -X POST ${BASE_URL}/api/v1/image/compress \\
  -H "Authorization: Bearer YOUR_API_KEY" \\
  -F "file=@photo.png" \\
  -F "quality=75" \\
  -F "format=webp" \\
  --output photo.webp`,
      node: `// Node 18+ (built-in fetch, FormData and Blob)
import { readFile, writeFile } from "node:fs/promises";

const form = new FormData();
form.append("file", new Blob([await readFile("photo.png")]), "photo.png");
form.append("quality", "75");
form.append("format", "webp");

const res = await fetch("${BASE_URL}/api/v1/image/compress", {
  method: "POST",
  headers: { Authorization: "Bearer YOUR_API_KEY" },
  body: form,
});
if (!res.ok) throw new Error((await res.json()).error.message);
await writeFile("photo.webp", Buffer.from(await res.arrayBuffer()));`,
      python: `import requests

res = requests.post(
    "${BASE_URL}/api/v1/image/compress",
    headers={"Authorization": "Bearer YOUR_API_KEY"},
    files={"file": open("photo.png", "rb")},
    data={"quality": 75, "format": "webp"},
)
res.raise_for_status()
with open("photo.webp", "wb") as f:
    f.write(res.content)`,
    },
  },
  {
    id: "merge",
    method: "POST",
    path: "/api/v1/pdf/merge",
    description: "Merges 2 to 20 PDF files into one document, in the order they are sent.",
    response: "The merged PDF (application/pdf). Header X-Page-Count reports the total pages. Password-protected PDFs are rejected with 422.",
    params: [
      { name: "files", type: "file[]", required: true, desc: "2 to 20 PDF files, each sent as a separate 'files' field." },
    ],
    snippets: {
      curl: `curl -X POST ${BASE_URL}/api/v1/pdf/merge \\
  -H "Authorization: Bearer YOUR_API_KEY" \\
  -F "files=@first.pdf" \\
  -F "files=@second.pdf" \\
  --output merged.pdf`,
      node: `// Node 18+ (built-in fetch, FormData and Blob)
import { readFile, writeFile } from "node:fs/promises";

const form = new FormData();
for (const name of ["first.pdf", "second.pdf"]) {
  form.append("files", new Blob([await readFile(name)]), name);
}

const res = await fetch("${BASE_URL}/api/v1/pdf/merge", {
  method: "POST",
  headers: { Authorization: "Bearer YOUR_API_KEY" },
  body: form,
});
if (!res.ok) throw new Error((await res.json()).error.message);
await writeFile("merged.pdf", Buffer.from(await res.arrayBuffer()));`,
      python: `import requests

res = requests.post(
    "${BASE_URL}/api/v1/pdf/merge",
    headers={"Authorization": "Bearer YOUR_API_KEY"},
    files=[
        ("files", open("first.pdf", "rb")),
        ("files", open("second.pdf", "rb")),
    ],
)
res.raise_for_status()
with open("merged.pdf", "wb") as f:
    f.write(res.content)`,
    },
  },
  {
    id: "csv",
    method: "POST",
    path: "/api/v1/data/csv-to-json",
    description: "Converts CSV with a header row into an array of JSON objects. Quoted fields may contain commas, quotes and line breaks.",
    response: 'JSON: { "rows": number, "columns": string[], "data": object[] }.',
    params: [
      { name: "csv_data", type: "string", required: true, desc: "The CSV text, sent as JSON {\"csv_data\": ...}. You can also send a raw text/csv body, or a multipart 'csv_data' or 'file' field." },
    ],
    snippets: {
      curl: `curl -X POST ${BASE_URL}/api/v1/data/csv-to-json \\
  -H "Authorization: Bearer YOUR_API_KEY" \\
  -H "Content-Type: text/csv" \\
  --data-binary @people.csv`,
      node: `const res = await fetch("${BASE_URL}/api/v1/data/csv-to-json", {
  method: "POST",
  headers: {
    Authorization: "Bearer YOUR_API_KEY",
    "Content-Type": "application/json",
  },
  body: JSON.stringify({ csv_data: "name,age\\nAlice,30\\nBob,25" }),
});
const body = await res.json();
if (!res.ok) throw new Error(body.error.message);
console.log(body.data); // [{ name: "Alice", age: "30" }, ...]`,
      python: `import requests

res = requests.post(
    "${BASE_URL}/api/v1/data/csv-to-json",
    headers={"Authorization": "Bearer YOUR_API_KEY"},
    json={"csv_data": "name,age\\nAlice,30\\nBob,25"},
)
res.raise_for_status()
print(res.json()["data"])  # [{'name': 'Alice', 'age': '30'}, ...]`,
    },
  },
];

const errors = [
  { status: "400", code: "invalid_request", desc: "A field is missing or invalid." },
  { status: "401", code: "missing_api_key / invalid_api_key", desc: "No key was sent, or it is invalid or revoked." },
  { status: "413", code: "payload_too_large", desc: "The request body is over 4 MB." },
  { status: "415", code: "unsupported_media_type", desc: "The file type or body format is not accepted." },
  { status: "422", code: "unprocessable", desc: "The input was readable but couldn't be converted (e.g. a password-protected PDF)." },
  { status: "429", code: "rate_limited", desc: "Too many requests. Wait for the number of seconds in Retry-After." },
];

export function ApiDocsPageClient() {
  const [selectedEndpoint, setSelectedEndpoint] = useState(endpoints[0].id);
  const [selectedLanguage, setSelectedLanguage] = useState<Language>("curl");
  const [copied, setCopied] = useState(false);

  const snippet = endpoints.find((ep) => ep.id === selectedEndpoint)!.snippets[selectedLanguage];

  const copyCode = async () => {
    try {
      await navigator.clipboard.writeText(snippet);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard can be blocked (insecure context or denied permission); the code stays selectable.
    }
  };

  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-2xl md:text-3xl font-extrabold tracking-tight">Developer API</h1>
        <p className="text-sm text-slate-500 dark:text-slate-400">
          Compress images, merge PDFs and convert CSV from your own code. Base URL:{" "}
          <code className="font-mono text-xs text-indigo-500">{BASE_URL}/api/v1</code>
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Endpoint Documentation */}
        <div className="lg:col-span-2 space-y-6 min-w-0">
          <div className="glass-card p-6 space-y-6">
            <h3 className="font-bold text-sm uppercase tracking-wider text-slate-400 flex items-center space-x-1.5">
              <Database className="w-4 h-4 text-indigo-500" />
              <span>Available Endpoints</span>
            </h3>

            <div className="space-y-6">
              {endpoints.map((ep) => (
                <div key={ep.path} className="border-b border-slate-100 dark:border-slate-800 pb-6 last:border-0 last:pb-0">
                  <div className="flex flex-wrap items-center gap-3 mb-2.5">
                    <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-indigo-500/10 text-indigo-500">
                      {ep.method}
                    </span>
                    <span className="font-mono text-xs font-bold text-slate-800 dark:text-slate-200 break-all">
                      {ep.path}
                    </span>
                    <button
                      onClick={() => setSelectedEndpoint(ep.id)}
                      className="text-[10px] font-semibold text-indigo-500 hover:underline"
                    >
                      Show example
                    </button>
                  </div>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mb-4 leading-relaxed">
                    {ep.description}
                  </p>

                  <div className="space-y-2">
                    <h5 className="text-[10px] uppercase font-bold text-slate-400">Parameters</h5>
                    <div className="overflow-x-auto">
                      <table className="w-full text-left text-xs border-collapse">
                        <thead>
                          <tr className="border-b border-slate-100 dark:border-slate-800 text-slate-400 text-[10px] uppercase">
                            <th className="py-2 pr-3 font-medium">Name</th>
                            <th className="py-2 pr-3 font-medium">Type</th>
                            <th className="py-2 pr-3 font-medium">Required</th>
                            <th className="py-2 font-medium">Description</th>
                          </tr>
                        </thead>
                        <tbody>
                          {ep.params.map((p) => (
                            <tr key={p.name} className="border-b border-slate-50 dark:border-slate-900/40">
                              <td className="py-2 pr-3 font-mono text-slate-700 dark:text-slate-300 font-semibold">{p.name}</td>
                              <td className="py-2 pr-3 text-indigo-400 font-mono text-[10px]">{p.type}</td>
                              <td className="py-2 pr-3 text-slate-500">{p.required ? "Yes" : "No"}</td>
                              <td className="py-2 text-slate-400 leading-normal">{p.desc}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                    <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed pt-1">
                      <span className="font-semibold text-slate-600 dark:text-slate-300">Response: </span>
                      {ep.response}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="glass-card p-6 space-y-4">
            <h3 className="font-bold text-sm uppercase tracking-wider text-slate-400 flex items-center space-x-1.5">
              <AlertTriangle className="w-4 h-4 text-amber-500" />
              <span>Errors &amp; Limits</span>
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
              Errors return JSON in the form{" "}
              <code className="font-mono">{`{ "error": { "code": "...", "message": "..." } }`}</code>. Each key may make
              60 requests per minute; every response carries X-RateLimit-Limit, X-RateLimit-Remaining and
              X-RateLimit-Reset headers. Request bodies are limited to 4 MB. CORS is enabled, but don&apos;t put your key in
              public front-end code.
            </p>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="border-b border-slate-100 dark:border-slate-800 text-slate-400 text-[10px] uppercase">
                    <th className="py-2 pr-3 font-medium">Status</th>
                    <th className="py-2 pr-3 font-medium">Code</th>
                    <th className="py-2 font-medium">Meaning</th>
                  </tr>
                </thead>
                <tbody>
                  {errors.map((e) => (
                    <tr key={e.status} className="border-b border-slate-50 dark:border-slate-900/40">
                      <td className="py-2 pr-3 font-mono font-semibold text-slate-700 dark:text-slate-300">{e.status}</td>
                      <td className="py-2 pr-3 font-mono text-[10px] text-indigo-400">{e.code}</td>
                      <td className="py-2 text-slate-400">{e.desc}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* Code Examples */}
        <div className="space-y-6 min-w-0">
          <div className="glass-card p-6 bg-slate-900 text-slate-100 border-slate-800 space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-800 pb-3">
              <h3 className="font-bold text-xs uppercase tracking-wider text-slate-400 flex items-center space-x-1.5">
                <Terminal className="w-4 h-4 text-indigo-400" />
                <span>Code Examples</span>
              </h3>
              <div className="flex bg-slate-800 p-0.5 rounded-lg border border-slate-700">
                {(["curl", "node", "python"] as const).map((lang) => (
                  <button
                    key={lang}
                    onClick={() => setSelectedLanguage(lang)}
                    className={`px-2.5 py-1 rounded text-[10px] font-semibold capitalize transition-all ${
                      selectedLanguage === lang
                        ? "bg-slate-700 text-white shadow"
                        : "text-slate-400 hover:text-slate-200"
                    }`}
                  >
                    {lang === "node" ? "NodeJS" : lang}
                  </button>
                ))}
              </div>
            </div>

            <label className="block text-[10px] uppercase font-bold text-slate-400">
              Endpoint
              <select
                value={selectedEndpoint}
                onChange={(e) => setSelectedEndpoint(e.target.value)}
                className="mt-1 w-full rounded-lg bg-slate-800 border border-slate-700 px-2 py-1.5 font-mono text-xs normal-case text-slate-100"
              >
                {endpoints.map((ep) => (
                  <option key={ep.id} value={ep.id}>{ep.path}</option>
                ))}
              </select>
            </label>

            <div className="relative">
              <pre className="font-mono text-xs overflow-x-auto p-3 bg-slate-950 rounded-xl max-h-[360px] border border-slate-800 leading-relaxed">
                <code>{snippet}</code>
              </pre>
              <button
                onClick={copyCode}
                aria-label="Copy code example"
                className="absolute top-2.5 right-2.5 p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white transition-all border border-slate-700"
              >
                {copied ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />}
              </button>
            </div>
          </div>

          <div className="p-4 rounded-xl border border-indigo-500/20 bg-indigo-500/5 text-xs text-indigo-700 dark:text-indigo-300 space-y-2.5">
            <h4 className="font-bold flex items-center space-x-1">
              <Globe className="w-4 h-4" />
              <span>Authentication</span>
            </h4>
            <p className="leading-relaxed">
              Send your API key in the header <code className="font-mono">Authorization: Bearer YOUR_API_KEY</code>.
              Create a free key on your Dashboard. Keep it private; if a key leaks, contact us to revoke it.
            </p>
            <Link href="/dashboard" className="font-semibold flex items-center space-x-1 hover:underline">
              <span>Create an API key</span>
              <ArrowRight className="w-3 h-3" />
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
