import { redirect } from "next/navigation";
import { hasAdmin } from "@/lib/actions/setup";
import AuthCard from "@/components/AuthCard";
import SetupForm from "@/components/SetupForm";

// hasAdmin() reads the DB directly with no per-request API (cookies/headers)
// to signal Next that the result can change, so without this the page gets
// statically cached at build time using whatever admin-existence state the
// database happened to be in during the build.
export const dynamic = "force-dynamic";

export default async function SetupPage() {
  if (await hasAdmin()) {
    redirect("/login");
  }

  return (
    <AuthCard
      title="初期セットアップ"
      subtitle="最初の管理者アカウントを作成します（この画面は最初の1回だけ使えます）"
    >
      <SetupForm />
    </AuthCard>
  );
}
