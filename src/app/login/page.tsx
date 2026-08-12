import AuthCard from "@/components/AuthCard";
import LoginForm from "@/components/LoginForm";

export default function LoginPage() {
  return (
    <AuthCard title="ログイン" subtitle="フットサルクラブ管理アプリ">
      <LoginForm />
    </AuthCard>
  );
}
