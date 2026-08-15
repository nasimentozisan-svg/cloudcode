import Link from "next/link";

export default function InviteCodeNotFound() {
  return (
    <div className="flex flex-1 items-center justify-center px-4 py-16 text-center">
      <div>
        <p className="text-lg font-semibold">招待コードが見つかりません</p>
        <Link href="/watch" className="mt-4 inline-block text-sm underline">
          コードを入力し直す
        </Link>
      </div>
    </div>
  );
}
