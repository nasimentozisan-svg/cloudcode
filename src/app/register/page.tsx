import AuthCard from "@/components/AuthCard";
import RegisterForm from "@/components/RegisterForm";

export default function RegisterPage() {
  return (
    <AuthCard title="新規登録" subtitle="選手・コーチアカウントを作成します">
      <RegisterForm />
    </AuthCard>
  );
}
