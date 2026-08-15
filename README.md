# TAC view

efktacで画面録画したサッカー戦術動画・試合フィードバック動画を、チーム内で共有するWebアプリ（PWA）。

- コーチ：ログインして動画をアップロード
- 選手：招待コードを入力するだけで、アカウント登録なしに閲覧可能

## 2つのセクション

- **戦術ボード**：局面別5フォルダ（攻撃／攻撃→守備／守備／守備→攻撃／特殊局面）にタイトル・説明つきで動画を整理。自動削除なし
- **試合フィードバック**：試合ごとにフォルダを作成（チーム区分・対戦相手を指定）し、動画を一括アップロード（タイトル不要）。選手はスワイプで次々に視聴可能。**アップロードから2週間で自動削除**（コーチはフォルダ単位でいつでも即時削除も可能）

## 構成

- Next.js（App Router）+ Tailwind CSS
- Supabase：動画のメタデータ（DB）とコーチのログイン（Auth）
- Cloudflare R2：動画本体の保存（無料枠・転送無料でこの規模なら実質無料）
- Vercel Cron：試合フィードバックの自動削除バッチ（毎日1回実行）

## セットアップ

### 1. Supabaseプロジェクトを作成

1. https://supabase.com でプロジェクトを新規作成
2. SQL Editorで `supabase/migrations/0001_init.sql` → `supabase/migrations/0002_match_feedback.sql` の順に内容を実行してテーブルを作成
3. Project Settings > API から `Project URL` と `anon public key` を取得
4. 同じ画面（または「Legacy anon, service_role API keys」タブ）から `service_role key` も取得（自動削除バッチ専用。選手・コーチの通常の操作には使いません）

### 2. Cloudflare R2バケットを作成

1. Cloudflareダッシュボード > R2 でバケットを新規作成
2. 「R2 APIトークンを管理」からAPIトークン（Object Read & Write）を発行し、Access Key ID / Secret Access Keyを取得
3. Account IDはCloudflareダッシュボードの右側に表示されているもの

### 3. 環境変数を設定

`.env.example` を `.env.local` にコピーして、上記で取得した値を入力してください。`CRON_SECRET`は自分で決めた適当な文字列でOKです（自動削除バッチの認証用）。

```bash
cp .env.example .env.local
```

### 4. 依存パッケージのインストール・起動

```bash
npm install
npm run dev
```

http://localhost:3000 で確認できます。

### 5. Vercelデプロイ時の追加設定

`vercel.json`に自動削除バッチのCron設定（毎日 UTC 18:00 = 日本時間3:00）が入っています。Vercelの環境変数に`SUPABASE_SERVICE_ROLE_KEY`と`CRON_SECRET`も忘れずに設定してください。

動作確認は、Vercelダッシュボードの「Cron Jobs」ログで見るか、以下のように手動でリクエストしても確認できます：

```bash
curl -H "Authorization: Bearer <CRON_SECRETの値>" https://<デプロイ先のURL>/api/cron/cleanup-match-feedback
```

## 使い方

### コーチ

1. トップページから「コーチとしてログイン」→ 初回はアカウント作成 → チーム名と選手に伝える招待コードを設定
2. ダッシュボードの「戦術ボード」タブから動画をアップロード（タイトル・説明・フォルダを指定）
3. 「試合フィードバック」タブから新規フォルダを作成（チーム区分・対戦相手を指定）→ フォルダ内で動画を一括アップロード

### 選手

トップページの「選手として動画を見る」から招待コードを入力 →「戦術ボード」または「試合フィードバック」を選択して視聴

## 注意事項

- 動画本体はR2に保存され、視聴時のみ有効期限付きURL（1時間）を発行して再生します
- 選手側はアカウント登録不要（招待コードのみ）のため、コードの扱いには注意してください
- 試合フィードバックの動画はアップロードから2週間で自動削除されます
