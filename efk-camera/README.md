# EFK CAMERA

エンフレンテ熊本フットサルクラブ専用の固定カメラ撮影アプリ（Android）。

KYV47 を三脚に固定して試合を撮影し、SHARK 9 / M40 Pro / PC の **ブラウザから**
録画開始・停止を遠隔操作します。録画が終わると YouTube へ自動でアップロードし、
**アップロード成功が確認できたときだけ** 端末内の元動画を削除します。

```
KYV47 で撮影  →  操作端末から録画開始  →  20〜40分連続録画  →  録画停止
      →  YouTube 自動アップロード  →  Video ID 取得  →  存在確認  →  元動画を自動削除
```

- 技術的な設計の全体像：[docs/EFK_CAMERA_v1_技術設計書.md](docs/EFK_CAMERA_v1_技術設計書.md)
- Google 側の設定手順：[SETUP_GOOGLE_CLOUD.md](SETUP_GOOGLE_CLOUD.md)
- 試合当日の運用手順：[OPERATIONS.md](OPERATIONS.md)
- セキュリティと Secrets の方針：[SECURITY.md](SECURITY.md)

---

## いちばん大事な2つの約束

1. **録画は簡単には止まらない。**
   操作端末との接続が切れても、Wi-Fi が落ちても、画面を消しても録画は続きます。
   止まるのは「録画停止」を押したときだけです。
2. **アップロード前に動画を消さない。**
   YouTube から Video ID を受け取り、`videos.list` で存在を確認し、その結果を
   端末に保存しきるまで、元動画は絶対に削除されません。

---

## 必要なもの

| 用途 | 内容 |
|---|---|
| 撮影端末 | KYOCERA KYV47（Android 8.0 以上） |
| 操作端末 | Blackview SHARK 9 / Teclast M40 Pro / Windows PC のブラウザ |
| ネットワーク | 同一 LAN（Wi-Fi ルーター または SHARK 9 のテザリング） |
| 開発環境 | Android Studio（Ladybug 以降）+ JDK 17 |
| Google | `emfrentekumamoto@gmail.com` と Google Cloud プロジェクト |

---

## セットアップの順番

### 1. Google Cloud の設定（先にやってください）

[SETUP_GOOGLE_CLOUD.md](SETUP_GOOGLE_CLOUD.md) の全9ステップ（約15分）。
**ここを先にやらないと、ビルドできてもアップロードだけ失敗します。**

### 2. ビルド

```bash
git clone https://github.com/nasimentozisan-svg/efk-camera.git
cd efk-camera

# CI と同じチェックを手元で回してから進めるのが確実
./gradlew lintDebug testDebugUnitTest assembleDebug
```

生成物：`app/build/outputs/apk/debug/app-debug.apk`

Android Studio を使う場合は、このフォルダを開いて ▶ を押すだけです。

### 3. KYV47 にインストール

```bash
# KYV47 の「設定 → 端末情報 → ビルド番号」を7回タップ →
# 「設定 → システム → 開発者向けオプション → USBデバッグ」をON
adb install -r app/build/outputs/apk/debug/app-debug.apk
```

USB が使えない場合は APK を KYV47 へ転送し、「提供元不明のアプリ」を
許可してインストールしてください。

### 4. 初回起動時にやること（KYV47 本体で）

1. カメラ・マイク・通知の権限を許可する
2. 「電池の最適化を外してください」のダイアログで **設定を開く → 許可**
3. 「Google アカウントを選ぶ」→ `emfrentekumamoto@gmail.com` を選択
4. Google の同意画面が出たら許可する（未確認アプリの警告が出ます。SETUP_GOOGLE_CLOUD.md 参照）
5. 画面に出ている **URL と6桁の PIN** を確認する

### 5. 操作端末から接続する

1. KYV47 と同じ Wi-Fi（またはテザリング）に接続する
2. ブラウザで `http://192.168.x.x:8080` を開く（KYV47 の画面の QR を読んでも可）
3. 6桁の PIN を入力する → 以降そのブラウザでは自動で入れます

---

## 40分連続録画テスト（必ず実施してください）

初回の本番前に、実際の設置状態で1回通しでやってください。

### 手順

1. KYV47 を三脚に固定し、**充電ケーブルを挿す**
2. 操作端末から接続し、試合名に `テスト` と入力
3. 「録画開始」→ **45分放置**
4. 5分ごとに操作画面を見て、下の表を埋める
5. 「録画停止」→ アップロードが最後まで通ることを確認
6. アップロード完了後に、端末の空き容量が戻っていることを確認

### 記録シート

| 経過 | 電池% | 電池温度 | 空き容量 | 録画状態 | 気づいたこと |
|---|---|---|---|---|---|
| 0分 | | | | | |
| 10分 | | | | | |
| 20分 | | | | | |
| 30分 | | | | | |
| 40分 | | | | | |
| 45分（停止） | | | | | |

### 合格条件

- [ ] 45分間、録画が一度も止まらなかった
- [ ] 電池温度が 45℃ を超えなかった
- [ ] 操作画面の経過時間が実時間とずれていない
- [ ] 一度ブラウザを閉じて開き直しても「録画中 ○○:○○」が復元された
- [ ] 録画ファイルが1本（分割されていない）
- [ ] 再生してコマ落ち・音ズレがない
- [ ] YouTube にアップロードされ、Video ID が取れた
- [ ] アップロード後に元動画が削除された

### うまくいかなかったら

| 症状 | 対処 |
|---|---|
| 途中で録画が止まる | 電池の最適化の除外を再確認。京セラ独自の省電力設定も OFF |
| 発熱が激しい | 設定から 720p へ。プレビューを OFF に。直射日光を避ける |
| ファイルが2つに分かれた | 想定より長く回した可能性。設定の「分割録画」が ON でないか確認 |
| 映像が上下逆 | 設定の「映像の向き」を A ↔ B で切り替える |
| アップロードが始まらない | 「Wi-Fi のときだけアップロード」が ON で、テザリング接続になっていないか |

---

## ビルドでエラーが出たら

このプロジェクトは Android SDK のあるマシンでの初回ビルドを前提にしています。
つまずきやすいところを先に書いておきます。

| エラー | 対処 |
|---|---|
| `SDK location not found` | Android Studio で開けば `local.properties` が自動生成されます。CLI なら `ANDROID_HOME` を設定してください |
| `Failed to install the following SDK components: platforms;android-35` | Android Studio の SDK Manager で **Android 15 (API 35)** を入れてください |
| `Unsupported class file major version` | JDK 17 を使ってください（`./gradlew -version` で確認） |
| `Unresolved reference: setTargetVideoEncodingBitRate` | CameraX が古い可能性。`gradle/libs.versions.toml` の `camerax` が `1.4.1` か確認してください |
| Google 認証だけ失敗する | debug と release で署名 SHA-1 が違います。**両方**を Google Cloud に登録してください（下記） |

### 署名 SHA-1 の確認

```bash
./gradlew signingReport
```

`Variant: debug` と `Variant: release` の SHA1 を **両方**
Google Cloud の OAuth クライアントに登録します（SETUP_GOOGLE_CLOUD.md ステップ6）。

---

## リリース（署名付き APK）

### 初回だけ：署名鍵を作る

```bash
keytool -genkeypair -v -keystore efk-camera-release.jks \
  -alias efkcamera -keyalg RSA -keysize 2048 -validity 10000

cp keystore.properties.example keystore.properties
# keystore.properties にパスワードを記入（.gitignore 済み）
```

> **`efk-camera-release.jks` は必ずバックアップしてください。**
> 失うと、同じアプリとしての更新配布ができなくなります。

### ローカルでビルド

```bash
./gradlew assembleRelease
# → app/build/outputs/apk/release/app-release.apk
```

### GitHub から配布（推奨）

```bash
git tag v1.0.0
git push origin v1.0.0
```

Actions が署名付き APK を作って Releases に添付します。
事前に GitHub の Secrets へ次の4件を登録してください。

| Secret 名 | 値 |
|---|---|
| `ANDROID_KEYSTORE_BASE64` | `base64 -w0 efk-camera-release.jks` の出力 |
| `ANDROID_KEYSTORE_PASSWORD` | キーストアのパスワード |
| `ANDROID_KEY_ALIAS` | `efkcamera` |
| `ANDROID_KEY_PASSWORD` | 鍵のパスワード |

---

## リポジトリの運用

### ブランチ

```
main         ← 常にビルドが通る状態だけ。ここにタグを打ってリリース
 ├ feat/xxx  ← 機能追加
 ├ fix/xxx   ← 不具合修正
 └ docs/xxx  ← ドキュメントのみ
```

`main` は PR 経由のみ。GitHub の
`Settings → Branches → Add branch ruleset` で以下を設定してください。

- Require a pull request before merging
- Require status checks to pass → **`Secret 混入チェック`** と **`ビルド / テスト / Lint`**
- Block force pushes

### CI

| ワークフロー | いつ | 何をするか |
|---|---|---|
| `Android CI` | push / PR | Secret 混入チェック・Lint・Unit Test・デバッグ APK ビルド |
| `Release APK` | タグ `v*` | 署名付き APK を作って Releases に添付 |

push 前にローカルで同じものを回せます。

```bash
bash scripts/check-secrets.sh
./gradlew lintDebug testDebugUnitTest assembleDebug
```

### Vercel は使いません

EFK CAMERA v1 はクラウドを一切使いません。操作画面の HTML/CSS/JS は
APK に同梱され、KYV47 自身が配信します。
理由は技術設計書 11.8 を参照してください。

---

## プロジェクト構成

```
app/src/main/java/jp/efk/camera/
├─ MainActivity.kt          KYV47 本体の画面（本体からも録画できる）
├─ EfkApp.kt                通知チャンネル・起動時のアップロード再開
├─ core/                    設定と、アプリ唯一の状態保持（AppState）
├─ camera/                  CameraX のバインドと録画セッション管理
├─ server/                  端末内 HTTP サーバ・PIN ペアリング・LAN 判定
├─ store/                   録画レコードの永続化と ★削除の安全装置
├─ upload/                  YouTube 再開可能アップロードと WorkManager
├─ auth/                    Google 認証（トークンはアプリに保存しない）
└─ util/                    書式・ログのマスク・容量計算・QR

app/src/main/assets/web/    操作端末のブラウザ画面（APK に同梱）
app/src/test/               CI で必ず回る Unit Test
```

### テストが守っているもの

| テスト | 守っていること |
|---|---|
| `DeletionGuardTest` | ★ 条件が揃わない限り元動画を削除しない |
| `ResumableRangeTest` | 通信断からの再開位置がずれない |
| `NetworkUtilsTest` | LAN 外からの操作を通さない |
| `RedactorTest` | ログに Credential が残らない |
| `FmtTest` | タイトルの形式と 100 文字制限 |
| `StoragePlannerTest` | 4GiB の壁を越えない容量設計 |
| `PairingLimiterTest` | PIN の総当たりを止める |
| `ThermalGuardTest` | 発熱時の挙動（録画は止めない） |
