/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  images: {
    domains: ["images.unsplash.com"],
  },
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "X-Frame-Options", value: "DENY" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
        ],
      },
    ];
  },
  serverExternalPackages: ["@huggingface/transformers"],
  outputFileTracingExcludes: {
    "**/*": [
      "node_modules/onnxruntime-node/**/*",
      "node_modules/@huggingface/transformers/**/*.wasm"
    ],
  },
  webpack: (config, { isServer }) => {
    // Enable async WebAssembly for ONNX Runtime Web (used by @huggingface/transformers)
    config.experiments = {
      ...config.experiments,
      asyncWebAssembly: true,
      layers: true,
    };
    
    // Ignore .node files to prevent webpack parsing errors
    config.module.rules.push({
      test: /\.node$/,
      loader: "ignore-loader",
    });

    // Prevent Webpack/Terser from crashing on import.meta in .mjs files (like onnxruntime-web)
    config.module.rules.push({
      test: /\.m?js$/,
      type: "javascript/auto",
      resolve: {
        fullySpecified: false,
      },
    });

    // onnxruntime-web (bundled with @huggingface/transformers) calls
    //   new URL(import.meta.url)
    // at module-init time. Webpack 5's default `parser.javascript.url = true`
    // rewrites those calls so `import.meta.url` becomes a Next.js RelativeURL
    // wrapper object rather than a plain string. RelativeURL's constructor
    // then does `url.replace(...)`, throws "url.replace is not a function",
    // and the whole table-detect pipeline dies at import time.
    //
    // Disabling `url` parsing ONLY for ORT files leaves import.meta.url as a
    // real string (or preserves the runtime shape ORT expects), so the
    // native URL constructor accepts it. Applies to the .bundle.min.mjs
    // that transformers.js dynamically imports on the client.
    config.module.rules.push({
      test: /onnxruntime-web[\\/].*\.m?js$/,
      parser: { url: false },
    });

    // Prevent Node.js-only modules from being bundled for the browser
    if (!isServer) {
      config.resolve.fallback = {
        ...config.resolve.fallback,
        fs: false,
        path: false,
        crypto: false,
        "node:fs": false,
        "node:path": false,
        "node:crypto": false,
      };
      
      // Alias onnxruntime-node to false for client build
      config.resolve.alias = {
        ...config.resolve.alias,
        "onnxruntime-node": false,
      };
    }

    // Ignore expected third-party module warnings to keep build logs clean
    config.ignoreWarnings = [
      { module: /node_modules\/@huggingface\/transformers/ },
      { module: /node_modules\/onnxruntime-web/ },
      { module: /node_modules\/docx/ },
    ];

    return config;
  },
};

export default nextConfig;
