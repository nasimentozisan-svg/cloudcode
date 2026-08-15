import { redirect } from "next/navigation";
import { hasAdmin } from "@/lib/actions/setup";
import { getCurrentUser } from "@/lib/current-user";
import { defaultLandingPath } from "@/lib/categories";

// Same reasoning as src/app/setup/page.tsx: hasAdmin() alone gives Next no
// signal to treat this route as per-request, so pin it explicitly instead
// of relying on getCurrentUser()'s cookies() call being reached at build time.
export const dynamic = "force-dynamic";

export default async function Home() {
  if (!(await hasAdmin())) {
    redirect("/setup");
  }

  const user = await getCurrentUser();
  if (!user) redirect("/login");
  redirect(defaultLandingPath(user.categories.map((c) => c.category)));
}
