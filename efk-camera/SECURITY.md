# セキュリティと Secrets の方針

---

## 1. このリポジトリに秘密情報は入れません

EFK CAMERA は、**リポジトリに入れなければならない秘密情報が 0 件**になるよう設計しています。

| よくある Credential | このプロジェクトでの扱い |
|---|---|
| Google OAuth クライアントシークレット | **発行されません**。Android 型の OAuth クライアントは「パッケージ名 + 署名SHA-1」で本人確認するため |
| アクセストークン | アプリは保存しません。Google Play 開発者サービスが都度発行し、メモリ上でのみ使用 |
| リフレッシュトークン | **アプリは受け取りません** |
| YouTube 認証情報 | 端末の Google アカウントに紐づくだけ |
| Google Cloud プロジェクトID / クライアントID | 秘密情報ではありません（公開前提の識別子） |
| ペアリング PIN / トークン | 端末内で実行時に生成。ソースにも Git にも存在しません |
| 署名キーストア | **唯一の本物の秘密**。次項で管理します |

---

## 2. 署名キーストアの扱い

```
efk-camera-release.jks   ← これを失うと、同じアプリとしての更新配布ができなくなります
keystore.properties      ← パスワードを書くファイル
```

- どちらも `.gitignore` 済みです
- `efk-camera-release.jks` は **作成直後に必ずバックアップ**してください
  （クラウドストレージの、他人と共有していないフォルダ）
- GitHub では Actions Secrets に置きます

| Secret 名 | 内容 |
|---|---|
| `ANDROID_KEYSTORE_BASE64` | `base64 -w0 efk-camera-release.jks` の出力 |
| `ANDROID_KEYSTORE_PASSWORD` | キーストアのパスワード |
| `ANDROID_KEY_ALIAS` | 鍵のエイリアス |
| `ANDROID_KEY_PASSWORD` | 鍵のパスワード |

**この4件は EFK CAMERA リポジトリ専用に登録します。**
Organization レベルの Secrets は使いません（他案件に共有されてしまうため）。

---

## 3. ログに Secrets を残さない

アプリ内では `android.util.Log` を直接呼ばず、必ず `SafeLog` を経由します。
`SafeLog` は出力前に `Redactor` で以下を自動マスクします。

| 対象 | マスク後 |
|---|---|
| `ya29.…`（アクセストークン） | `ya29.***` |
| `Authorization: Bearer …` | `Bearer ***` |
| `1//…`（リフレッシュトークン） | `1//***` |
| `AIza…`（API キー） | `AIza***` |
| アップロードURLの `upload_id` | `upload_id=***` |
| ペアリングトークン `efk_…` | `efk_***` |
| 秘密鍵（PEM） | 本文を削除 |
| メールアドレス | `emf***@gmail.com` |

この動作は `RedactorTest` で CI 上で検証されます。
また `scripts/check-secrets.sh` が、`Log.` の直接呼び出しが増えていないかを検査します。

リリースビルドでは ProGuard により `Log.v/d/i` そのものが削除されます。

---

## 4. CI での混入検査

`scripts/check-secrets.sh` が push / PR ごとに実行され、次を検査します。

1. 追跡してはいけないファイルが `git ls-files` に出ていないか
   （`*.jks` `*.keystore` `keystore.properties` `local.properties`
   `google-services.json` `client_secret*.json` `.env` など）
2. ソースに Credential らしき文字列がないか
   （`ya29.` `1//` `AIza` `-----BEGIN PRIVATE KEY-----` `service_account` など）
3. `android.util.Log` の直接呼び出しがないか

補助として gitleaks も走らせますが、外部サービスの状態に CI 全体が
引きずられないよう **こちらは非ブロッキング**にしています。
**ゲートとして機能するのは自前のスクリプトです。**

### GitHub 側でもう1枚

リポジトリ作成後に有効化してください（Private でも無料です）。

```
Settings → Code security
  ├ Secret scanning            → Enable
  └ Push protection            → Enable
```

Push protection を入れておくと、**秘密情報を含む push がそもそも弾かれます。**

---

## 5. 端末・LAN のセキュリティ

操作画面は HTTP（暗号化なし）で配信します。その代わり4段構えで守ります。

| # | 対策 | 内容 |
|---|---|---|
| 1 | 接続元制限 | プライベートIP（`10/8` `172.16/12` `192.168/16` `169.254/16` `127/8`）以外は 403 |
| 2 | PIN ペアリング | 起動ごとに6桁 PIN を生成。KYV47 の画面にのみ表示 |
| 3 | トークン | ペアリング以外の全 API はトークン必須。HttpOnly Cookie で保持 |
| 4 | レート制限 | PIN 5回失敗で10分ロック。解除時に PIN を再生成 |

### なぜ HTTPS にしないのか

自己署名証明書にすると、ブラウザに毎回警告が出て
**「試合直前に操作画面が開けない」**という事故につながります。

- 同一LAN内・平文・試合中だけの短時間運用であること
- 漏れて困るのは「録画操作の権限」だけで、**YouTube の認証情報は端末外に出ない**こと

以上から、v1 は HTTP + 上記4段構えを選択しました。

### 運用上のお願い

- 公衆 Wi-Fi では使わないでください（テザリングか、クラブの Wi-Fi を使う）
- 貸し出した操作端末を回収したら、本体画面から「ペアリング解除」を実行してください

---

## 6. 端末内のデータ

- 録画ファイルはアプリ専用領域（`Android/data/jp.efk.camera/files/Movies/`）に保存します
  - 他のアプリからは読めません
  - **アプリをアンインストールすると一緒に消えます**
- 設定とペアリングトークンは `SharedPreferences` に保存します
- クラウドバックアップ・端末間転送の対象から全て除外しています
  （`res/xml/data_extraction_rules.xml`）

---

## 7. 脆弱性を見つけたら

公開 Issue にはせず、つるさんへ直接連絡してください。
