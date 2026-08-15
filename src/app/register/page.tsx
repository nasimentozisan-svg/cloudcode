import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/current-user";
import { defaultLandingPath } from "@/lib/categories";
import AuthCard from "@/components/AuthCard";
import RegisterForm from "@/components/RegisterForm";

export const dynamic = "force-dynamic";

export default async function RegisterPage() {
  const user = await getCurrentUser();
  if (user) redirect(defaultLandingPath(user.categories.map((c) => c.category)));

  return (
    <AuthCard title="新規登録" subtitle="選手・コーチアカウントを作成します">
      <RegisterForm />
    </AuthCard>
  );
}
