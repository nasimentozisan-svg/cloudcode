import { redirect } from "next/navigation";
import { hasAdmin } from "@/lib/actions/setup";
import AuthCard from "@/components/AuthCard";
import SetupForm from "@/components/SetupForm";

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
