# EFK 関連4アプリ インフラ一覧

4つのアプリの実体・保存先をまとめたもの。どれかのアプリを触る前に、まずここを読んで
「他のアプリと何か共有していないか」を確認してから作業すること。

最終更新: 2026-08-20（このドキュメントを作成した時点の調査結果）

## 1. EFK members（このアプリ）

- **リポジトリ**: `nasimentozisan-svg/cloudcode`
- **開発ブランチ**: `claude/futsal-club-app-ideas-h0a3nf`
- **ホスティング**: Vercel プロジェクト「efk-members」
- **公開URL**: https://efk-members.vercel.app
- **データベース**: Prisma Postgres（`pooled.db.prisma.io`、有料Starterプラン $10/月）
- **ファイル保存**: Vercel Blob（Publicストア、env prefix `PUBLICBLOB_*`）
  - 選手証の写真・JFA名簿PDF・メッセージの添付ファイル
  - 旧ストア（`efk-crads`、Private、env prefix なし=`BLOB_*`）は**もう使っていない設定ミスの遺物**。
    アクセス方式が後から変更できず使えないため放置している。実害はないが、いつか気になったら
    Vercelダッシュボードから削除してよい（削除してもこのアプリの動作には影響しない）
- **他アプリとの共有**: なし（DB・ストレージともに完全に独立）

## 2. TACview（戦術動画）

- **リポジトリ**: `nasimentozisan-svg/cloudcode`（EFK membersと**同じリポジトリ**、別ブランチ）
- **開発ブランチ**: `claude/efk-tactic-video-sharing-mplxyk`
- **ホスティング**: Vercel プロジェクト「cloudcode」（efk-membersとは別プロジェクト）
- **公開URL**: https://cloudcode-one.vercel.app/watch
- **データベース**: Supabase（EFK membersのPrisma Postgresとは別サービス・別容量枠）
- **ファイル保存**: Cloudflare R2（動画。EFK membersのVercel Blobとは別サービス・別容量枠）
- **他アプリとの共有**: なし。ただしEFK membersと**同じGitHubリポジトリ**なので、
  ブランチを間違えて作業しないよう要注意（例: EFK members用の変更を誤ってこちらの
  ブランチにpushしない）

## 3. EFKtac（戦術ボード）

- **リポジトリ**: `nasimentozisan-svg/cloudcode`（これも同じリポジトリの別ブランチ）
- **ブランチ**: `claude/app-link-feature-jvdk5s`（`tactics/index.html` 1ファイルのみ）
- **ホスティング**: GitHub Pages（Vercelではない）
- **公開URL**: https://nasimentozisan-svg.github.io/cloudcode/tactics/
- **データベース・ファイル保存**: なし。完全に静的なHTML/CSS/JS1ファイルで完結、
  ブラウザのlocalStorageのみ使用（サーバー側の容量は一切消費しない）
- **他アプリとの共有**: なし

## 4. EFKtime（タイマー&スコア）

- **リポジトリ**: `nasimentozisan-svg/efk-futsal-timer`（唯一の別リポジトリ）
- **ホスティング**: GitHub Pages
- **公開URL**: https://nasimentozisan-svg.github.io/efk-futsal-timer/
- **データベース・ファイル保存**: なし。静的HTML/CSS/JS（PWA対応のmanifest.jsonあり）
- **他アプリとの共有**: なし

## まとめ: 容量・干渉の関係

| | DB/保存先 | 他アプリへの影響 |
|---|---|---|
| EFK members | Prisma Postgres + Vercel Blob | 独立 |
| TACview | Supabase + Cloudflare R2 | 独立 |
| EFKtac | なし（静的） | 影響しようがない |
| EFKtime | なし（静的） | 影響しようがない |

**4つとも保存先が完全に別々**なので、一つのアプリの容量がいっぱいになっても他の3つには
影響しない。唯一の注意点は、EFK members・TACview・EFKtacが**同じGitHubリポジトリの別ブランチ**
になっている点 — ブランチを間違えると別アプリのコードを触ってしまうリスクがあるので、
作業を始める前に必ず「今どのブランチにいるか」を確認すること。
