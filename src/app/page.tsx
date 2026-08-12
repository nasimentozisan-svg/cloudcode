import { redirect } from "next/navigation";
import { hasAdmin } from "@/lib/actions/setup";
import { getCurrentUser } from "@/lib/current-user";

export default async function Home() {
  if (!(await hasAdmin())) {
    redirect("/setup");
  }

  const user = await getCurrentUser();
  redirect(user ? "/dashboard" : "/login");
}
