// Runs once at server startup, before any route/action modules (including
// externally-loaded packages) are touched. pdfjs-dist's legacy build needs
// this in place before it's ever imported — see next.config.ts.
export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    await import("@/lib/dommatrix-polyfill");
  }
}
