import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/current-user";
import AuthCard from "@/components/AuthCard";
import LoginForm from "@/components/LoginForm";

export const dynamic = "force-dynamic";

export default async function LoginPage() {
  const user = await getCurrentUser();
  if (user) redirect("/dashboard");

  return (
    <AuthCard title="ログイン" subtitle="フットサルクラブ管理アプリ">
      <LoginForm />
    </AuthCard>
  );
}
