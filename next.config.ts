import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // pdfjs-dist must stay external: bundling it normally breaks its
  // dynamic import of pdf.worker.mjs ("Cannot find module .../pdf.worker.mjs").
  // The DOMMatrix polyfill it needs is installed in src/instrumentation.ts,
  // which runs before Turbopack's external-module loading.
  serverExternalPackages: ["pdfjs-dist", "sharp"],
  // pdfjs-dist loads pdf.worker.mjs via a dynamically-computed path, so
  // Vercel's build-time file tracer doesn't detect it as a dependency and
  // leaves it out of the deployed function bundle ("Cannot find module
  // .../pdfjs-dist/legacy/build/pdf.worker.mjs" at runtime). Force it in.
  outputFileTracingIncludes: {
    "/admin/cards": ["./node_modules/pdfjs-dist/legacy/build/pdf.worker.mjs"],
  },
  experimental: {
    serverActions: {
      bodySizeLimit: "80mb",
    },
  },
};

export default nextConfig;
