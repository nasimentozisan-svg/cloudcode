import Image from "next/image";

export default function AuthCard({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50 px-4 py-10">
      <div className="w-full max-w-md rounded-xl border border-gray-200 bg-white p-8 shadow-sm">
        <div className="flex justify-center">
          <Image src="/logo.png" alt="EFK menbers" width={72} height={72} priority />
        </div>
        <h1 className="mt-4 text-center text-xl font-bold text-gray-900">{title}</h1>
        {subtitle && (
          <p className="mt-1 text-center text-sm text-gray-500">{subtitle}</p>
        )}
        <div className="mt-6">{children}</div>
      </div>
    </div>
  );
}
