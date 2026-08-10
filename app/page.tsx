import Link from "next/link";

export default function Home() {
  return (
    <div className="flex flex-1 items-center justify-center px-4 py-16">
      <div className="w-full max-w-sm space-y-8 text-center">
        <div>
          <h1 className="text-3xl font-bold">TAC view</h1>
          <p className="mt-2 text-slate-500">
            efktacで録画した戦術動画をチームで共有
          </p>
        </div>

        <div className="space-y-3">
          <Link
            href="/watch"
            className="block w-full rounded-md bg-slate-900 py-3 font-medium text-white hover:bg-slate-800"
          >
            選手として動画を見る
          </Link>
          <Link
            href="/coach/login"
            className="block w-full rounded-md border border-slate-300 bg-white py-3 font-medium hover:bg-slate-50"
          >
            コーチとしてログイン
          </Link>
        </div>
      </div>
    </div>
  );
}
