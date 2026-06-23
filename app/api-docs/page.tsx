"use client";

import React, { useState } from "react";
import { Terminal, Copy, Check, Play, Globe, Database, ArrowRight } from "lucide-react";

export default function ApiDocs() {
  const [selectedLanguage, setSelectedLanguage] = useState<"curl" | "node" | "python">("curl");
  const [copied, setCopied] = useState(false);

  const endpoints = [
    {
      method: "POST",
      path: "/api/v1/image/compress",
      description: "Compresses file sizes for PNG, JPG, or SVG image uploads.",
      params: [
        { name: "file", type: "file", required: true, desc: "Image file to compress." },
        { name: "quality", type: "number", required: false, desc: "Compression factor (1 to 100). Default: 80." },
      ],
    },
    {
      method: "POST",
      path: "/api/v1/pdf/merge",
      description: "Merges multiple PDF binary structures into a single file payload.",
      params: [
        { name: "files", type: "file[]", required: true, desc: "List of PDF binary documents." },
      ],
    },
    {
      method: "POST",
      path: "/api/v1/data/csv-to-json",
      description: "Transforms CSV comma-separated table formatting to standard JSON schema arrays.",
      params: [
        { name: "csv_data", type: "string", required: true, desc: "String of tabular CSV data rows." },
      ],
    },
  ];

  const codeSnippets = {
    curl: `curl -X POST https://easytoconvert.com/api/v1/image/compress \\
  -H "Authorization: Bearer YOUR_API_TOKEN" \\
  -F "file=@/path/to/image.png" \\
  -F "quality=75"`,
    node: `const axios = require('axios');
const FormData = require('form-data');
const fs = require('fs');

const form = new FormData();
form.append('file', fs.createReadStream('/path/to/image.png'));
form.append('quality', '75');

axios.post('https://easytoconvert.com/api/v1/image/compress', form, {
  headers: {
    ...form.getHeaders(),
    'Authorization': 'Bearer YOUR_API_TOKEN'
  }
})
.then(response => console.log(response.data))
.catch(error => console.error(error));`,
    python: `import requests

url = "https://easytoconvert.com/api/v1/image/compress"
headers = {
    "Authorization": "Bearer YOUR_API_TOKEN"
}
files = {
    "file": open("/path/to/image.png", "rb")
}
data = {
    "quality": 75
}

response = requests.post(url, headers=headers, files=files, data=data)
print(response.json())`
  };

  const copyCode = () => {
    navigator.clipboard.writeText(codeSnippets[selectedLanguage]);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-2xl md:text-3xl font-extrabold tracking-tight">Developer API</h1>
        <p className="text-sm text-slate-500 dark:text-slate-400">
          Integrate our conversion and optimization core directly into your software pipelines.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Endpoint Documentation */}
        <div className="lg:col-span-2 space-y-6">
          <div className="glass-card p-6 space-y-6">
            <h3 className="font-bold text-sm uppercase tracking-wider text-slate-400 flex items-center space-x-1.5">
              <Database className="w-4 h-4 text-indigo-500" />
              <span>Available Endpoints</span>
            </h3>

            <div className="space-y-6">
              {endpoints.map((ep) => (
                <div key={ep.path} className="border-b border-slate-100 dark:border-slate-800 pb-6 last:border-0 last:pb-0">
                  <div className="flex items-center space-x-3.5 mb-2.5">
                    <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-indigo-500/10 text-indigo-500">
                      {ep.method}
                    </span>
                    <span className="font-mono text-xs font-bold text-slate-800 dark:text-slate-200">
                      {ep.path}
                    </span>
                  </div>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mb-4 leading-relaxed">
                    {ep.description}
                  </p>

                  <div className="space-y-2">
                    <h5 className="text-[10px] uppercase font-bold text-slate-400">Parameters</h5>
                    <table className="w-full text-left text-xs border-collapse">
                      <thead>
                        <tr className="border-b border-slate-100 dark:border-slate-800 text-slate-400 text-[10px] uppercase">
                          <th className="py-2 font-medium">Name</th>
                          <th className="py-2 font-medium">Type</th>
                          <th className="py-2 font-medium">Required</th>
                          <th className="py-2 font-medium">Description</th>
                        </tr>
                      </thead>
                      <tbody>
                        {ep.params.map((p) => (
                          <tr key={p.name} className="border-b border-slate-50 dark:border-slate-900/40">
                            <td className="py-2 font-mono text-slate-700 dark:text-slate-300 font-semibold">{p.name}</td>
                            <td className="py-2 text-indigo-400 font-mono text-[10px]">{p.type}</td>
                            <td className="py-2 text-slate-500">{p.required ? "Yes" : "No"}</td>
                            <td className="py-2 text-slate-400 leading-normal">{p.desc}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Code Generator & Console */}
        <div className="space-y-6">
          <div className="glass-card p-6 bg-slate-900 text-slate-100 border-slate-800 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="font-bold text-xs uppercase tracking-wider text-slate-400 flex items-center space-x-1.5">
                <Terminal className="w-4 h-4 text-indigo-400" />
                <span>Code Sandbox</span>
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

            <div className="relative">
              <pre className="font-mono text-xs overflow-x-auto p-3 bg-slate-950 rounded-xl max-h-[300px] border border-slate-800 leading-relaxed">
                <code>{codeSnippets[selectedLanguage]}</code>
              </pre>
              <button
                onClick={copyCode}
                className="absolute top-2.5 right-2.5 p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white transition-all border border-slate-700"
              >
                {copied ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />}
              </button>
            </div>
          </div>

          <div className="p-4 rounded-xl border border-indigo-500/20 bg-indigo-500/5 text-xs text-indigo-300 space-y-2.5">
            <h4 className="font-bold flex items-center space-x-1">
              <Globe className="w-4 h-4" />
              <span>Authentication Token</span>
            </h4>
            <p className="leading-relaxed">
              API requests require a Bearer token in the Authorization header. You can generate tokens on your User Dashboard. Keep tokens private.
            </p>
            <a href="/dashboard" className="text-white font-semibold flex items-center space-x-1 hover:underline">
              <span>Go create token</span>
              <ArrowRight className="w-3 h-3" />
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}
