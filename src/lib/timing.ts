import { reportHealth } from "@/lib/health";

// Server-side timing for the pages the app opens on, logged as one line per
// request (no user data) so production logs show where launch time goes:
// session+user lookup vs the page's own data, and whether the request
// landed on a freshly started (cold) function instance.
let warm = false;

// Above this a page is slow enough that members notice (and it usually
// means a stuck cold start / DB connection) - worth a look by the health check.
const SLOW_THRESHOLD_MS = 5000;

// quiet: skip the per-request line and only report when slow - for pages
// hit constantly (the channel page re-renders on an 8s poll).
export function startTiming(route: string, { quiet = false }: { quiet?: boolean } = {}) {
  const cold = !warm;
  warm = true;
  const t0 = performance.now();
  let authMs: number | null = null;
  return {
    authDone() {
      authMs = Math.round(performance.now() - t0);
    },
    end() {
      const totalMs = Math.round(performance.now() - t0);
      if (!quiet) {
        console.log(
          `[timing] ${route} cold=${cold} auth=${authMs ?? "-"}ms data=${authMs === null ? "-" : totalMs - authMs}ms total=${totalMs}ms`
        );
      }
      if (totalMs > SLOW_THRESHOLD_MS) {
        reportHealth("slow", { route, cold, auth_ms: authMs ?? "none", total_ms: totalMs });
      }
    },
  };
}
