import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "プライバシーポリシー | EFK members",
  description: "EFK membersアプリのプライバシーポリシーです。",
};

export default function PrivacyPage() {
  return (
    <main className="mx-auto max-w-2xl px-4 py-10 text-sm leading-7 text-gray-800">
      <h1 className="text-xl font-bold text-gray-900">プライバシーポリシー</h1>
      <p className="mt-4">
        EFK members（以下「本アプリ」）は、フットサルクラブ「EFK」のメンバー間の連絡・スケジュール管理を目的とした、
        クラブ関係者専用の非公開アプリです。
      </p>

      <h2 className="mt-8 text-base font-bold text-gray-900">取得する情報</h2>
      <p className="mt-2">
        登録時に入力されたお名前・メールアドレス・所属カテゴリー等、および本アプリの利用に伴い生成される情報
        （出欠回答・メッセージ・選手証画像など）を、本アプリの提供目的の範囲でのみ保存・利用します。
      </p>

      <h2 className="mt-8 text-base font-bold text-gray-900">第三者提供</h2>
      <p className="mt-2">
        取得した情報を本人の同意なく第三者に提供することはありません。
      </p>

      <h2 className="mt-8 text-base font-bold text-gray-900">Googleカレンダー連携について</h2>
      <p className="mt-2">
        クラブ管理者が許可した場合に限り、本アプリのスケジュール情報をクラブのGoogleカレンダーへ自動で反映する機能を提供しています。
        この連携で取得したGoogleアカウントへのアクセス権は、この同期機能のためだけに使用します。
      </p>

      <h2 className="mt-8 text-base font-bold text-gray-900">お問い合わせ</h2>
      <p className="mt-2">本アプリに関するお問い合わせは、クラブ管理者までご連絡ください。</p>
    </main>
  );
}
