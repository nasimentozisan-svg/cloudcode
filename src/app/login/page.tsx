import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/current-user";
import { defaultLandingPath } from "@/lib/categories";
import AuthCard from "@/components/AuthCard";
import LoginForm from "@/components/LoginForm";

export const dynamic = "force-dynamic";

export default async function LoginPage() {
  const user = await getCurrentUser();
  if (user) redirect(defaultLandingPath(user.categories.map((c) => c.category)));

  return (
    <AuthCard title="ログイン" subtitle="フットサルクラブ管理アプリ">
      <LoginForm />
    </AuthCard>
  );
}
