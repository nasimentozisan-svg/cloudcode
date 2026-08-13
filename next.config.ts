import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // pdfjs-dist must stay external: bundling it normally breaks its
  // dynamic import of pdf.worker.mjs ("Cannot find module .../pdf.worker.mjs").
  // The DOMMatrix polyfill it needs is installed in src/instrumentation.ts,
  // which runs before Turbopack's external-module loading.
  serverExternalPackages: ["pdfjs-dist", "sharp"],
  experimental: {
    serverActions: {
      bodySizeLimit: "80mb",
    },
  },
};

export default nextConfig;
