// Server-side timing for the pages the app opens on, logged as one line per
// request (no user data) so production logs show where launch time goes:
// session+user lookup vs the page's own data, and whether the request
// landed on a freshly started (cold) function instance.
let warm = false;

export function startTiming(route: string) {
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
      console.log(
        `[timing] ${route} cold=${cold} auth=${authMs ?? "-"}ms data=${authMs === null ? "-" : totalMs - authMs}ms total=${totalMs}ms`
      );
    },
  };
}
