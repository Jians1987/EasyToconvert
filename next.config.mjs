/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  images: {
    domains: ["images.unsplash.com"],
  },
  eslint: {
    ignoreDuringBuilds: true,
  },
  typescript: {
    ignoreBuildErrors: true,
  },
  experimental: {
    serverComponentsExternalPackages: ["onnxruntime-node", "@huggingface/transformers"],
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
