# TAC view

efktacで画面録画したサッカー戦術動画を、局面別フォルダ（攻撃／攻撃→守備／守備／守備→攻撃／特殊局面）に整理してチーム内で共有するWebアプリ（PWA）。

- コーチ：ログインして動画をアップロード（タイトル・説明つき）
- 選手：招待コードを入力するだけで、アカウント登録なしに閲覧可能

## 構成

- Next.js（App Router）+ Tailwind CSS
- Supabase：動画のメタデータ（DB）とコーチのログイン（Auth）
- Cloudflare R2：動画本体の保存（無料枠・転送無料でこの規模なら実質無料）

## セットアップ

### 1. Supabaseプロジェクトを作成

1. https://supabase.com でプロジェクトを新規作成
2. SQL Editorで `supabase/migrations/0001_init.sql` の内容を実行してテーブルを作成
3. Project Settings > API から `Project URL` と `anon public key` を取得

### 2. Cloudflare R2バケットを作成

1. Cloudflareダッシュボード > R2 でバケットを新規作成
2. 「R2 APIトークンを管理」からAPIトークン（Object Read & Write）を発行し、Access Key ID / Secret Access Keyを取得
3. Account IDはCloudflareダッシュボードの右側に表示されているもの

### 3. 環境変数を設定

`.env.example` を `.env.local` にコピーして、上記で取得した値を入力してください。

```bash
cp .env.example .env.local
```

### 4. 依存パッケージのインストール・起動

```bash
npm install
npm run dev
```

http://localhost:3000 で確認できます。

## 使い方

1. トップページから「コーチとしてログイン」→ 初回はアカウント作成 → チーム名と選手に伝える招待コードを設定
2. ダッシュボードから動画をアップロード（タイトル・説明・フォルダを指定）
3. 選手はトップページの「選手として動画を見る」から招待コードを入力すればフォルダ別に動画を閲覧可能

## 注意事項

- 動画本体はR2に保存され、視聴時のみ有効期限付きURL（1時間）を発行して再生します
- 選手側はアカウント登録不要（招待コードのみ）のため、コードの扱いには注意してください
