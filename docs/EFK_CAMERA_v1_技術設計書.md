# EFK CAMERA v1 技術設計書

エンフレンテ熊本フットサルクラブ専用 固定カメラ撮影システム
作成日：2026-09-17 / 対象バージョン：v1 (MVP)

---

### 目次

| 章 | 内容 |
|---|---|
| 1 | KYV47 で実現可能か（Android バージョン / API レベル） |
| 2 | CameraX による 40分連続録画 |
| 3 | 遠隔操作の通信方式（LAN内 HTTP + ブラウザ） |
| 4 | YouTube 自動アップロード方式 |
| 5 | Google Cloud / OAuth の整理 |
| 6 | Android バックグラウンド制限への対策 |
| 7 | 動画削除の安全条件 |
| 8 | MVP のアーキテクチャ |
| 9 | 実装スコープと進め方 |
| 10 | 想定リスクと対処 |
| **11** | **GitHub / CI / Vercel / Secrets / リリース運用**（追加ご指示への回答） |
| **12** | **ご確認・ご判断をお願いしたいこと** |

---

## 0. この文書の位置づけ

依頼にあった「最初にやってほしいこと」1〜8 への回答に、追加でご指示いただいた
**【GitHub / CI / Vercel / Secrets / リリース運用】（第11章）** を加えたものです。
結論を先に書き、根拠と代替案・リスクをその下に置いています。

**本文書は「設計フェーズの成果物」です。実装はまだ着手していません。**
ご確認・ご判断をいただきたい点を「第12章 確認事項」にまとめました。
そこにご回答いただいてから実装へ進みます。

### 先にお伝えする重要な制約（正直な申し送り）

この開発環境からは `dl.google.com`（Android SDK・AndroidX の配布元）へ
ネットワークアクセスが遮断されているため、**Android SDK を導入できず、
コンパイル・実機動作確認を行えていません。**
コードは API の仕様に沿って書いていますが、**最初のビルドは
つるさんの Android Studio 上で行っていただく必要があります**。
ビルドで詰まりやすい箇所は README の「ビルドでエラーが出たら」に
先回りしてまとめてあります。

---

## 1. KYV47 の Android バージョン / API レベルで実現可能か

### 結論：実現可能。ただし Android 9 (API 28) 前提で設計する。

| 項目 | 内容 |
|---|---|
| 機種 | KYOCERA KYV47 (au TORQUE G04) |
| OS | Android 9 Pie (API 28) 想定 |
| SoC | Snapdragon 630 (8コア / Adreno 508) |
| RAM / ROM | 3GB / 32GB |
| Google Play 開発者サービス | あり（au 販売の Google 認定端末） |

本アプリは **minSdk 26 (Android 8.0)** / **targetSdk 35** で構成しています。
KYV47 が Android 9 でも 10 でも、そのまま動作します。

#### つるさんに確認していただきたいこと（所要2分）

KYV47 で
`設定 → 端末情報 → Android バージョン`
を開き、表示された番号を教えてください。

- **8.0 以上** → そのまま進めて問題ありません
- **8.0 未満** → minSdk を下げる必要があります（要連絡）

#### API レベルによる設計上の分岐

| 機能 | API 28 (KYV47) での扱い |
|---|---|
| foregroundServiceType | manifest に宣言。API 28 では無視されるが新しい端末で必須 |
| `PowerManager.getCurrentThermalStatus()` | API 29+。**使えないので電池温度で代替**（後述 6.4） |
| `POST_NOTIFICATIONS` 権限 | API 33+。API 28 では不要（自動で付与扱い） |
| Scoped Storage | API 29+。本アプリはアプリ専用領域のみ使うため影響なし |
| Camera2 ハードウェアレベル | TORQUE G04 は LIMITED 想定 → 同時バインドするストリーム数を絞る設計（後述 2.3） |

---

## 2. CameraX による 40分連続録画の実現方法

### 2.1 結論：CameraX `VideoCapture` + `Recorder` を使う。

MediaRecorder を直接叩くより、CameraX の `Recorder` の方が
「端末ごとの Camcorder プロファイル差異の吸収」「ファイルサイズ上限到達の
イベント通知」「エラー種別の細分化」が整備されており、長時間録画に向きます。

```
Recorder.Builder()
  .setQualitySelector(QualitySelector.from(FHD, FallbackStrategy.lowerQualityOrHigherThan(HD)))
  .setTargetVideoEncodingBitRate(8_000_000)   // ← ここが最重要
  .build()
```

### 2.2 40分録画で必ず問題になる「4GB の壁」への対策

Android の MP4 出力は、多くの端末で **1ファイル 4GB 前後**で頭打ちになります
（MediaMuxer / ファイルシステムの実装依存）。

CamcorderProfile の 1080p30 は端末により **17〜20Mbps** が既定値です。
この設定だと：

```
20 Mbps × 2400秒 ÷ 8 = 6.0 GB  → 40分の途中で必ず破綻する
```

そこで **ビットレートを明示的に 8Mbps へ落とします**。

| 設定 | 40分の想定サイズ | 60分の想定サイズ | 判定 |
|---|---|---|---|
| 1080p30 / 20Mbps（端末既定） | 約 6.0 GB | 約 9.0 GB | ✗ 破綻 |
| **1080p30 / 8Mbps（本アプリ既定）** | **約 2.4 GB** | 約 3.6 GB | ✓ 安全 |
| 720p30 / 5Mbps（フォールバック） | 約 1.5 GB | 約 2.3 GB | ✓ 安全 |

フットサルの固定ワイド撮影（カメラが動かない＝動き補償が効く）であれば
8Mbps でも実用画質を確保できます。アップロード時間も 1/2 以下になり、
「試合後すぐ帰りたい」運用と相性が良いです。

### 2.3 それでも上限に達した場合：自動パート継続

保険として `FileOutputOptions.setFileSizeLimit(3.5GB)` を設定し、
`ERROR_FILE_SIZE_LIMIT_REACHED` を受け取ったら
**録画を止めずに次のファイル（パート2）へ自動継続**します。

```
[録画セッション]
  ├ part 1 (3.5GB で自動区切り) → YouTube「… (1/2)」
  └ part 2 (停止まで)           → YouTube「… (2/2)」
```

これにより「上限に当たって録画が終わってしまった」という
最悪のケースを構造的に排除します。

同じ仕組みを使い、任意設定で **時間分割録画（10分 / 15分ごと）** も
選べるようにしてあります（既定はOFF）。
プロセスが強制終了された場合、書き込み中の MP4 は moov アトミックが
書かれず再生不能になるため、「どうしても失敗させたくない大事な試合」では
分割録画をONにすると被害を最大10分に抑えられます。
（通常は1試合1動画が扱いやすいので既定OFF）

### 2.4 カメラのバインド構成（LIMITED 端末への配慮）

プレビューを含めて3ストリームを同時に開くと、古い端末では
バインドに失敗したり録画が不安定になります。そこで：

```
第1候補： VideoCapture + ImageAnalysis   ← 通常はこれ
第2候補： VideoCapture のみ              ← 失敗したら自動降格（プレビュー無効）
```

**`Preview` ユースケースは一切バインドしません。**
KYV47 本体の画面に映すプレビューも、操作端末のブラウザに流す MJPEG も、
**すべて同じ `ImageAnalysis` の1本から作ります**。

これにより「アプリ画面を開いた／閉じた」「画面が消えた」といった操作で
カメラセッションが再構成されることが**原理的に起こらなくなり**、
録画中断リスクを大きく下げられます。

### 2.5 40分連続録画テストの手順（実機で必ず実施）

`efk-camera/README.md` の「40分連続録画テスト」に、
チェック項目（発熱・電池・容量・コマ落ち・音ズレ）と
記録シートを用意しています。

---

## 3. 遠隔操作の通信方式

### 3.1 結論：KYV47 内に HTTP サーバを立て、ブラウザから操作する。

```
┌─────────────────────────┐
│ KYV47 （EFK CAMERA）           │
│  ┌───────────────────┐  │
│  │ NanoHTTPD : 8080          │  │
│  │  /            操作UI(HTML) │  │
│  │  /api/status  状態JSON     │  │
│  │  /api/record/start|stop    │  │
│  │  /api/preview.mjpg         │  │
│  └───────────────────┘  │
└──────────┬──────────────┘
           │ 同一LAN (Wi-Fiルーター or SHARK 9 テザリング)
   ┌───────┼────────┬─────────┐
   │       │        │         │
 SHARK 9  M40 Pro  Windows PC  （ブラウザだけでOK）
```

- **操作端末に専用アプリは不要。** Chrome / Edge / Safari で `http://192.168.x.x:8080` を開くだけ。
- **Wi-Fi Direct は使いません。** 依頼どおり、通常の Wi-Fi ルーター経由、
  および SHARK 9 のテザリング配下のどちらでも同じ仕組みで動きます。
- KYV47 の IP アドレスはアプリ画面に大きく表示し、**QRコードでも出します**
  （SHARK 9 のカメラで読むだけで操作画面が開く）。

### 3.2 なぜ WebSocket ではなく「1秒ポーリング」なのか

| 方式 | 判定 |
|---|---|
| WebSocket | 切断検知・再接続処理が必要。実装が増え、切れたときの状態が読みにくい |
| SSE | 接続がスレッドを占有。Android の省電力で切られたときの復帰が読みにくい |
| **1秒ポーリング（採用）** | **切れても次の1秒で勝手に復帰する。状態は毎回フルで受け取るので取りこぼしゼロ** |

経過時間の表示は、`録画開始時刻` を受け取ってブラウザ側で
毎秒カウントするため、ポーリング間隔でカクつくことはありません。

**この設計により「操作端末が切れても録画は続き、再接続したら
`録画中 23:41` が即座に復元される」が自然に成立します**
（サーバは状態を持つだけで、接続の有無を録画制御に一切使わない）。

### 3.3 プレビュー

`ImageAnalysis` のフレームを JPEG 化し、
`multipart/x-mixed-replace`（MJPEG）で配信します。
ブラウザ側は `<img src="/api/preview.mjpg">` を置くだけで表示でき、
遅延は 0.3〜0.7 秒程度です。

- 既定 640×360 / 4fps / JPEG品質55（発熱とCPUを抑えるため）
- **見ている人が誰もいない間は JPEG 変換自体を止めます**（発熱対策）
- プレビュー ON/OFF は操作画面から切替可能
- `ImageAnalysis` のバインドに失敗した端末では自動的に
  「プレビュー利用不可」と表示し、**録画機能は通常どおり動きます**

### 3.4 セキュリティ（依頼の「URLを知られただけで操作されない」への回答）

4段構えです。

1. **プライベートIPからの接続のみ受理**
   `10.0.0.0/8` `172.16.0.0/12` `192.168.0.0/16` `169.254.0.0/16` `127.0.0.0/8` 以外は即 403。
2. **PINペアリング**
   アプリ起動ごとに6桁PINを生成し、KYV47 の画面に表示。
   操作端末は初回だけ PIN を入力 → 端末固有トークン（32バイト乱数）を受け取る。
3. **トークン必須**
   ペアリング以外の全 API はトークン必須。トークンは Cookie に保存されるので
   2回目以降は自動ログイン。KYV47 側から一覧表示・個別失効ができます。
4. **PIN総当たり対策**
   5回失敗で10分ロック。ロック解除時に PIN を再生成。

> **HTTPS ではなく HTTP である点について**
> 自己署名証明書にすると、ブラウザに毎回警告が出て
> 「試合直前に操作画面が開けない」事故につながります。
> 同一LAN内・平文・短時間の運用であること、盗まれて困るのは
> 録画操作権のみ（YouTube の認証情報は端末外に出ない）であることから、
> **v1 では HTTP + PIN + プライベートIP制限**を採用しました。

---

## 4. YouTube 自動アップロード方式

### 4.1 結論：YouTube Data API v3 の **再開可能アップロード（resumable upload）** を自前実装。

Google 公式クライアントライブラリ（`google-api-services-youtube`）も
再開可能アップロードに対応していますが、**アップロードURLをプロセスをまたいで
永続化できません**。つまり「アプリが落ちた／Wi-Fiが切れた」ときに
2.4GB を最初からやり直すことになります。

そこで OkHttp で下記プロトコルを直接実装し、**アップロードURLと
進捗バイト数をディスクに保存**します。

```
① POST https://www.googleapis.com/upload/youtube/v3/videos
        ?uploadType=resumable&part=snippet,status
   X-Upload-Content-Length: <ファイルサイズ>
   X-Upload-Content-Type: video/mp4
   body: {"snippet":{...},"status":{"privacyStatus":"unlisted",...}}
   → 200 / Location: <uploadUrl>     ★ uploadUrl を端末に保存

② PUT <uploadUrl>
   Content-Range: bytes <開始>-<終了>/<全体>
   → 200/201（完了・JSONにvideoIdあり） or 308（継続）

   【通信断で失敗したら】
   PUT <uploadUrl>  Content-Range: bytes */<全体>   (本文なし)
   → 308 / Range: bytes=0-<受信済み>   ★ ここから再開

③ 完了レスポンスの JSON から id（YouTube Video ID）を取得
```

これにより **「アップロード中に Wi-Fi が切れても、復旧後に続きから再開」** が成立します。

### 4.2 バックグラウンド実行：WorkManager + フォアグラウンドワーカー

```
録画停止
 → VideoStore に PENDING_UPLOAD として登録（ファイルは消さない）
 → WorkManager.enqueueUniqueWork(NetworkType.CONNECTED, 指数バックオフ)
 → UploadWorker が setForeground() でフォアグラウンド化
    （= 10分制限を受けずに 2.4GB を上げきれる）
 → 進捗を VideoStore と操作画面へ反映
```

WorkManager を使う理由：

- アプリが落ちても、端末が再起動しても、**OSがジョブを復活させてくれる**
- 「ネットワークがつながったら自動実行」が OS レベルで保証される
  → 依頼の「次回アプリ起動時またはネット接続復旧時に再試行」がそのまま実現
- 指数バックオフ（30秒 → 1分 → 2分 …）が標準で用意されている

### 4.3 動画タイトル

```
<録画開始日の日付 YYYY-MM-DD> <操作端末で入力した試合名>
```

例：`2026-09-17 GRTIA CUP U18 vs ○○高校`

- 日付は録画開始時に端末時計から自動取得
- 試合名は録画開始前に操作画面で入力（未入力なら `試合` を補完）
- 分割された場合のみ末尾に ` (1/2)` を付与
- 説明欄には撮影日時・端末名・録画時間・解像度を自動記入

---

## 5. Google Cloud / OAuth の整理

### 5.1 結論：Google Play 開発者サービス経由の認証（`GoogleAuthUtil`）を使う。

```
KYV47 の「Google アカウント」から emfrentekumamoto@gmail.com を選択
   ↓
Play 開発者サービスが OAuth 同意画面を表示（初回のみ）
   ↓
以降、アクセストークンは Play 開発者サービスが都度発行・自動更新
```

**アプリはパスワードもリフレッシュトークンも一切保持しません。**
依頼の「パスワードをアプリ内に保存する方式は禁止」「初回のみ Google 認証」を
最もきれいに満たす方式です。

| 方式 | パスワード保存 | 再認証頻度 | 採用 |
|---|---|---|---|
| **GoogleAuthUtil（採用）** | なし | 初回のみ（端末に紐づく） | ✓ |
| OAuth デバイスフロー | なし（refresh_token は保持） | **テスト公開中は7日ごと** | ✗ |
| ID/パスワード直打ち | あり | — | ✗ 禁止 |

デバイスフローは「公開ステータス＝テスト」の間、リフレッシュトークンが
**7日で失効**します。毎週再認証は運用に耐えないため不採用としました。

### 5.2 必要な OAuth スコープ

| スコープ | 用途 |
|---|---|
| `https://www.googleapis.com/auth/youtube.upload` | 動画のアップロード |
| `https://www.googleapis.com/auth/youtube.readonly` | **アップロード成功確認**（削除前の必須条件） |

`youtube.readonly` は「削除しても大丈夫か」を YouTube 側に問い合わせるために
必要です。これがないと安全な自動削除ができません。

### 5.3 限定公開（unlisted）についての正直な説明

YouTube Data API には次の仕様があります。

> **Google の監査（audit）を受けていない API プロジェクトからアップロードされた
> 動画は、`privacyStatus` に何を指定しても強制的に `private` になる。**

つまり **最初は必ず「非公開」でアップロードされます**。これは不具合ではなく仕様です。

本アプリの対応：

1. アップロード時は常に `unlisted` を要求する（監査通過後は自動で限定公開になる）
2. アップロード後に **実際の `privacyStatus` を YouTube から読み戻す**
3. 要求と違っていたら、エラーにせず操作画面へ明示する

```
✓ アップロード完了
  ⚠ 現在API制限により非公開でアップロードされています
     （YouTubeの「自分の動画」から限定公開に変更できます）
  [ YouTubeで確認 ]
```

監査申請は Google Cloud Console から行えますが、**申請しなくても運用は可能**です
（アップロード自体は成功し、YouTube Studio 側で手動で限定公開に変更できます）。
まずは監査なしで運用開始し、必要になったら申請する方針を推奨します。

### 5.4 API クォータ

YouTube Data API の既定クォータは 1日 10,000 units。
`videos.insert` = 1,600 units / `videos.list` = 1 unit。

```
10,000 ÷ 1,601 ≒ 6本/日
```

**1日6試合までアップロード可能**。複数コート・大会日で足りない場合は
Google Cloud Console からクォータ増加申請が必要です（設計書に手順を記載）。

### 5.5 つるさんにお願いする作業

`efk-camera/SETUP_GOOGLE_CLOUD.md` に
**画面名・ボタン名まで指定した手順（所要15分・全9ステップ）** を用意しました。
コード側で用意できるものはすべて用意済みで、
つるさんにお願いするのは Google の Web 画面での操作だけです。

---

## 6. Android バックグラウンド制限への対策

### 6.1 フォアグラウンドサービス

`EfkCameraService` を **START_STICKY のフォアグラウンドサービス**として常駐させ、
この中で「カメラ」「録画」「HTTPサーバ」をすべて保持します。

```xml
<service android:name=".service.EfkCameraService"
         android:foregroundServiceType="camera|microphone" />
```

通知に「REC 18:42」と経過時間を出し続けるので、
OS からは「ユーザーが認識している実行中の処理」として扱われ、
バックグラウンド制限の対象外になります。

### 6.2 WakeLock / WifiLock

| ロック | 目的 |
|---|---|
| `PARTIAL_WAKE_LOCK` | 画面を消しても CPU を止めない（録画継続） |
| `WIFI_MODE_FULL_HIGH_PERF` | 省電力で Wi-Fi が切れて操作不能になるのを防ぐ |

録画中とアップロード中のみ取得し、終わったら必ず解放します。

### 6.3 電池最適化の除外

初回起動時に
`REQUEST_IGNORE_BATTERY_OPTIMIZATIONS` のダイアログを出します。

さらに **京セラ / au 端末には独自の省電力機能がある**ため、
アプリ内の「運用チェックリスト」画面に手順を表示します：

- `設定 → 電池 → 電池の最適化` → EFK CAMERA を「最適化しない」
- 京セラ独自の省電力設定があれば OFF
- `設定 → 画面 → スリープ` を長めに
- **録画中は必ず充電ケーブルを接続**（40分 1080p 録画は電池消費が大きい）

### 6.4 発熱対策（API 28 で `ThermalStatus` が使えない件）

`PowerManager.getCurrentThermalStatus()` は API 29 以降のため
KYV47 では使えません。代わりに **`ACTION_BATTERY_CHANGED` の
`EXTRA_TEMPERATURE`（電池温度）** を 10 秒ごとに監視します。

| 電池温度 | アプリの挙動 |
|---|---|
| 〜40℃ | 通常 |
| 40〜45℃ | 操作画面に黄色の警告。プレビューを自動停止して負荷を下げる |
| 45℃〜 | 赤色の警告を継続表示（**録画は止めません**） |

> **設計判断：高温でも自動で録画を止めません。**
> 「試合が録れていない」ことの損失の方が圧倒的に大きいためです。
> 警告を出して人間に判断させます。

---

## 7. 動画削除の安全条件

### 7.1 削除が実行される唯一の条件

以下が **すべて** 満たされたときだけ削除します。

```
[1] videos.insert が HTTP 200/201 を返した
[2] レスポンス JSON から id（YouTube Video ID）を取得できた
[3] videos.list?id=<取得したID> で items が 1件返ってきた   ← 存在確認
[4] status.uploadStatus が "uploaded" または "processed" である
[5] [1]〜[4] の結果を端末内DBに VERIFIED として保存し終えた
```

**[5] が最後にある点が重要です。**
「確認はできたが、保存する前にアプリが落ちた」場合、
次回起動時の状態は VERIFIED ではないので削除は実行されません。
**判定と削除を別のトランザクションに分け、必ず判定結果の永続化を先に行います。**

### 7.2 状態遷移

```
RECORDING
   ↓ 録画停止
PENDING_UPLOAD ──────────────┐
   ↓ ワーカー起動               │
UPLOADING ─(通信断)─→ PENDING_UPLOAD（uploadUrl保持・続きから再開）
   ↓ insert 成功 + videoId 取得   │
UPLOADED ─(確認失敗)──────────┘
   ↓ videos.list で存在確認OK
VERIFIED        ★ここで初めて削除可能になる
   ↓ ファイル削除
DONE
```

別系統として：

```
　　　　　　→ FAILED_PERMANENT （uploadStatus が "rejected" 等）
　　　　　　　　※著作権クレーム・重複など。ファイルは絶対に消さず、赤字で警告
```

### 7.3 「絶対に消さない」ための実装上の保証

| ケース | 挙動 |
|---|---|
| アップロード中に Wi-Fi 切断 | 状態は PENDING_UPLOAD のまま。ファイル保持。復旧後に続きから |
| アップロード中にアプリ強制終了 | WorkManager が復活させる。uploadUrl は保存済み |
| YouTube が 500 を返した | リトライ。ファイル保持 |
| videos.list が失敗 | **UPLOADED 止まり。削除しない。** 後で再確認 |
| 動画が rejected | FAILED_PERMANENT。削除しない。操作画面に赤字警告 |
| 端末再起動 | 起動時に PENDING_UPLOAD を全部再エンキュー |
| **アプリがクラッシュして孤児ファイルが残った** | 起動時に録画フォルダを走査し、DB にないファイルを「要確認」として登録。**自動削除は絶対にしない** |
| ユーザーが手動で消そうとした | 未アップロードなら警告文＋確認入力を要求 |

削除処理そのものも、実行直前に **DBから状態を読み直して**
`state == VERIFIED && videoId != null` を再確認してから `File.delete()` します。

### 7.4 ストレージの事前チェック

録画開始前に空き容量を確認し、
**現在のビットレートで 60分録れる容量 + 2GB の余裕**がなければ
録画開始をブロックします（操作画面に理由を表示）。

```
1080p/8Mbps の場合： 3.6GB + 2.0GB = 5.6GB 必要
```

「未アップロード動画があって容量が足りない」ケースは、
操作画面の「アップロード待ち」一覧から状況が一目で分かるようにしています。

---

## 8. MVP のアーキテクチャ

### 8.1 全体図

```
┌──────────────── KYV47 (EFK CAMERA) ────────────────┐
│                                                             │
│  MainActivity            EfkCameraService (Foreground)      │
│  ├ サーバURL/QR/PIN      ├ CameraController                 │
│  ├ 状態表示              │   ├ ImageAnalysis → PreviewHub   │
│  ├ Googleサインイン      │   └ VideoCapture(Recorder)       │
│  └ 運用チェックリスト     ├ ControlServer (NanoHTTPD:8080)   │
│                          ├ WakeLock / WifiLock              │
│         ┌────────────┘   └ 電池・温度・容量の監視            │
│         │                                                   │
│         ▼                                                   │
│   ┌──────────┐      ┌──────────┐   ┌────────────┐ │
│   │ AppState   │◀────▶│ VideoStore │◀─▶│ UploadWorker │ │
│   │(StateFlow) │      │(JSON永続化)│   │ (WorkManager)│ │
│   └──────────┘      └──────────┘   └──────┬─────┘ │
│                                                   │         │
│                              GoogleAuthManager ───┤         │
│                              (Play開発者サービス)  │         │
└───────────────────────────────────────────┼─────┘
                      │ HTTP(LAN)                    │ HTTPS
        ┌─────────────┘                    ┌────▼──────┐
   SHARK 9 / M40 Pro / PC のブラウザ          │  YouTube    │
   （assets/web の HTML+JS。1秒ポーリング）    │  Data API v3│
                                             └───────────┘
```

### 8.2 状態の持ち方（設計の核）

**単一の `AppState`（`MutableStateFlow`）がアプリ全体の唯一の真実**です。

- `EfkCameraService` だけが `AppState` を更新する
- `MainActivity`（本体画面）も `ControlServer`（ブラウザ）も **読むだけ**
- したがって「本体画面で見える状態」と「ブラウザで見える状態」は必ず一致する
- 操作端末の接続状態は `AppState` に**一切影響しない**
  → 依頼の「接続切断だけで録画停止してはいけない」を構造で保証

### 8.3 クラス構成

| パッケージ | クラス | 責務 |
|---|---|---|
| `core` | `AppState` | 全状態の単一保持者（StateFlow） |
| | `Prefs` | 設定の永続化（解像度・分割・音声・プレビュー） |
| `service` | `EfkCameraService` | 常駐。カメラ・サーバ・各種監視の所有者 |
| `camera` | `CameraController` | CameraX のバインド／録画セッション管理 |
| | `PreviewHub` | 最新JPEGフレームの配給（本体画面 + MJPEG） |
| `server` | `ControlServer` | NanoHTTPD。REST + 静的配信 + MJPEG |
| | `AuthTokens` | PINペアリングとトークン管理 |
| | `NetworkUtils` | LAN IP 取得・プライベートIP判定 |
| `store` | `VideoStore` | 録画レコードの JSON 永続化（原子的書き込み） |
| | `VideoRecord` | 1録画ファイルの状態 |
| `upload` | `YouTubeUploader` | 再開可能アップロード + 存在確認 |
| | `UploadWorker` | WorkManager ワーカー |
| | `UploadScheduler` | エンキュー・再試行 |
| `auth` | `GoogleAuthManager` | アカウント選択とアクセストークン取得 |

### 8.4 なぜ Room / Compose / kotlinx.serialization を使わないか

いずれも良いライブラリですが、**この環境でコンパイル検証ができない**以上、
アノテーションプロセッサやコンパイラプラグインを増やすほど
「つるさんの環境で最初のビルドが通らない」確率が上がります。

- DB → `org.json` による JSON ファイル（Android 標準・依存ゼロ）
- UI → XML レイアウト + `findViewById`（Compose コンパイラ不要）
- JSON → `org.json`（プラグイン不要）

データ量は多くて数十件なので、性能上の問題はありません。

### 8.5 依存ライブラリ（すべて Maven Central / Google Maven）

| ライブラリ | 用途 |
|---|---|
| `androidx.camera:camera-*:1.4.2` | 録画 |
| `androidx.work:work-runtime-ktx:2.10.0` | アップロードのバックグラウンド実行 |
| `com.squareup.okhttp3:okhttp:4.12.0` | 再開可能アップロード |
| `org.nanohttpd:nanohttpd:2.3.1` | 端末内 HTTP サーバ |
| `com.google.android.gms:play-services-auth:21.3.0` | Google 認証（`GoogleAuthUtil`） |
| `com.google.zxing:core:3.5.3` | ペアリング用QRコード生成 |

### 8.6 操作画面（ブラウザUI）

`app/src/main/assets/web/` に同梱。依頼のイメージどおりのレイアウトです。

```
┌──────────────────────┐
│      EFK CAMERA             │
│  KYV47   ● 接続中            │
│  BATTERY 82%   FREE 31GB    │
│──────────────────────│
│  試合名                      │
│  [ GRTIA CUP U18 vs ○○高校 ]│
│──────────────────────│
│     CAMERA PREVIEW          │
│──────────────────────│
│        00:00:00             │
│   [  🔴  録 画 開 始  ]      │
└──────────────────────┘
```

- ボタンは画面幅いっぱい・高さ 80px 以上（グローブや汗でも押せるように）
- 録画停止ボタンだけ **長押し1.5秒**（誤タップで試合が切れるのを防ぐ）
- ダークテーマ（屋内コートで眩しくない）
- 画面スリープ防止（Wake Lock API があれば使用）

### 8.7 将来拡張への備え

v1 では作り込みませんが、下記が後から入るように穴を開けてあります。

| 拡張項目 | v1 での備え |
|---|---|
| 複数カメラ同時管理 | 状態JSONに `deviceId` / `deviceName` を最初から含めている |
| 前半/後半ボタン | 録画セッションが「パート」の概念を既に持っている |
| チーム名・大会名テンプレート | タイトルは `date + freeText` の合成関数に分離済み |
| 再生リスト自動振り分け | アップロードのリクエスト組み立てを1関数に集約 |
| 撮影履歴・アップロード履歴 | `VideoStore` が全レコードを永続保持（DONE も残す） |
| 熊本店/筑後店・複数コート | `Prefs` に `siteName` を追加するだけの構造 |
| QR接続 | **v1 で実装済み** |

---

## 9. 実装スコープと残りの作業

### 9.1 v1 で実装する範囲（承認後に着手）

- [ ] KYV47 常駐サービス（カメラ・サーバ・監視）
- [ ] ブラウザからの録画開始・停止
- [ ] PIN / QR ペアリング + プライベートIP制限
- [ ] 状態表示（接続・電池・容量・録画状態・経過時間・温度警告）
- [ ] MJPEG プレビュー（失敗時は自動で無効化）
- [ ] 1080p/720p 切替・ビットレート制御
- [ ] 4GB 到達時の自動パート継続 / 任意の時間分割
- [ ] YouTube 再開可能アップロード（通信断からの再開）
- [ ] Video ID 取得 + 存在確認 + 実 privacyStatus の読み戻し
- [ ] 3条件を満たした場合のみの自動削除
- [ ] アップロード待ち管理・手動再試行・誤削除防止
- [ ] 起動時の孤児ファイル回収
- [ ] 電池最適化除外の誘導・運用チェックリスト
- [ ] GitHub Actions CI（ビルド / Unit Test / Lint / Secret 検査）
- [ ] 署名付き APK のリリース自動化

### 9.2 v1 では **やらない** と決めたこと

| やらないこと | 理由 |
|---|---|
| Vercel / クラウドサーバ | 録画操作をクラウド稼働に依存させないため（第11章） |
| 外部からのインターネット越し操作 | 同一LAN限定にすることがそのまま安全設計になるため |
| 複数カメラ同時制御 | MVP を確実に完成させることを優先（拡張の穴だけ開けておく） |
| 動画の端末内プレイヤー／編集 | YouTube 側で足りる |
| Room / Jetpack Compose | ビルド再現性を最優先（8.4節） |

### 9.3 作業の進め方（この順番）

| # | 担当 | 内容 | 所要 |
|---|---|---|---|
| 1 | **つるさん** | 本設計書の確認・第12章への回答 | 15分 |
| 2 | AI | 実装・CI 構築・ドキュメント整備 | — |
| 3 | **つるさん** | KYV47 の Android バージョン確認 | 2分 |
| 4 | **つるさん** | Google Cloud の設定（手順書どおり） | 15分 |
| 5 | **つるさん** | Android Studio でビルド・KYV47 へインストール | 30分 |
| 6 | **つるさん** | 40分連続録画テスト（チェックシートあり） | 1時間 |
| 7 | AI | 実測値に合わせたビットレート等の調整 | — |

---

## 10. 想定リスクと対処

| リスク | 影響 | 対処 |
|---|---|---|
| KYV47 が 40分 1080p を持たない（熱暴走） | 致命的 | 720p へ切替。テストで必ず確認 |
| CameraX が KYV47 で不安定 | 致命的 | ストリーム構成を最小化済み。ダメなら MediaRecorder 直叩きへ退避 |
| 監査前のため非公開アップロードになる | 中 | 仕様として明示表示。YouTube Studio で手動変更 |
| API クォータ 6本/日 | 中 | 大会日は要注意。増加申請の手順を記載 |
| テザリングが従量課金で 2.4GB を消費 | 中 | 「Wi-Fiのみアップロード」設定を用意 |
| 端末時計がずれてタイトル日付が狂う | 小 | 自動時刻同期ONを運用チェックリストに記載 |
| プロセス強制終了で MP4 が壊れる | 中 | 分割録画オプション。フォアグラウンド＋WakeLockで確率を最小化 |
| **署名キーストアの紛失** | 大 | 紛失すると同一アプリとしての更新配布ができなくなる。作成直後にクラウドへバックアップ（11.5.2） |
| debug/release で SHA-1 が違い認証だけ失敗 | 中 | 両方の SHA-1 を Google Cloud に登録（11.7.4） |
| CI が赤いままリリースしてしまう | 中 | `main` にブランチ保護をかけ、CI 緑でないとマージ不可にする（11.3.3） |

---

---

## 11. GitHub / CI / Vercel / Secrets / リリース運用

> 追加ご指示（デプロイ事故防止）への回答です。
> **結論を先に書くと：v1 に Vercel は不要です。GitHub は専用リポジトリを新設し、
> 録画機能は GitHub・Vercel・YouTube のどれが止まっても動きます。**

### 11.1 役割分担（確定案）

| 構成要素 | 担当範囲 | 録画機能への関与 |
|---|---|---|
| **GitHub** | ソースコード管理・変更履歴・CI・APK配布 | **なし**（開発時のみ） |
| **KYV47 の EFK CAMERA** | 撮影・録画・ファイル保持・操作画面の配信 | **これが全部** |
| **操作端末のブラウザ** | 操作UIの表示（HTMLはKYV47から配信） | 開始/停止の指示のみ |
| **YouTube Data API** | 録画**後**のアップロード | なし（録画後の処理） |
| **Vercel** | **v1 では使用しない** | なし |

操作画面の HTML / CSS / JS は **APK の中に同梱**し、KYV47 自身が配信します。
CDN も外部ホスティングも使いません。したがって
**インターネットが完全に切れている体育館でも、操作画面は普通に開けます。**

### 11.2 外部サービス障害時の影響（最重要）

| 障害 | 操作画面表示 | 録画開始 | 長時間録画継続 | 録画停止 | 端末内保存 | YouTubeアップロード |
|---|---|---|---|---|---|---|
| GitHub 停止 | ○ | ○ | ○ | ○ | ○ | ○ |
| Vercel 停止 | ○ | ○ | ○ | ○ | ○ | ○ |
| YouTube 停止 / API障害 | ○ | ○ | ○ | ○ | ○ | **✗ → アップロード待ちで保持** |
| インターネット全断（LANは生きている） | ○ | ○ | ○ | ○ | ○ | **✗ → 復旧後に自動再試行** |
| 体育館Wi-Fiがローカル専用（外に出られない） | ○ | ○ | ○ | ○ | ○ | 帰宅後に自動再試行 |
| 操作端末のバッテリー切れ・アプリ終了 | ✗ | — | **○ 継続** | KYV47本体で可 | ○ | ○ |
| Wi-Fiルーター / テザリングが落ちる | ✗ | ✗ | **○ 継続** | **KYV47本体で可** | ○ | 復旧後 |
| KYV47 の EFK CAMERA が強制終了 | ✗ | ✗ | ✗ | — | 直前までのファイルは残る | 次回起動時に再試行 |

この表から導いた **必須の実装要件**：

1. **KYV47 本体の画面にも「録画開始 / 録画停止」ボタンを必ず置く。**
   LAN ごと落ちても録画を止められる最後の手段。
2. **操作端末との接続状態を録画制御に一切使わない。**（8.2節の AppState 設計で構造的に保証）
3. **YouTube への到達可否を、録画の前提条件にしない。**
   未サインインでも録画は開始できる（警告は出す）。
4. **アップロードは録画とは完全に別プロセス（WorkManager）**。
   アップロードが何回失敗しても、録画側には影響しない。

### 11.3 GitHub リポジトリ構成

#### 11.3.1 専用リポジトリの新設（ご指示どおり独立管理）

```
新設: github.com/nasimentozisan-svg/efk-camera   （Private 推奨）
```

現在この作業は `nasimentozisan-svg/cloudcode` ブランチ
`claude/efk-camera-v1-design-ydp96a` で行っています。
ただし調べたところ **`cloudcode` は Public リポジトリで、
かつ TAC view（戦術動画共有アプリ）のコードが入っています。**

ご指示の「他案件と混在させない」に反するため、
**EFK CAMERA は専用リポジトリ `efk-camera` へ分離すべき**と考えます。
リポジトリ新設は本番環境への変更にあたるため、勝手には実行しません
（第12章 Q1 でご判断をお願いします）。

参考：現在のアカウントのリポジトリ一覧（今回触れてはいけない既存資産）

| リポジトリ | 公開設定 | 備考 |
|---|---|---|
| `cloudcode` | **Public** | 今回の作業ブランチ。TAC view が同居 |
| `tac-view` | Public | TAC view 本体 |
| `efk-futsal-timer` | Public | — |
| `efk-instagram-kpi` | Public | — |
| `efk-instagram-analytics` | Private | — |
| `instagram-automation` | Private | — |
| `SNS-AI-IMAGE-PIPELINE` | Private | — |
| `ouchi-shuno-analytics` | Public | — |

**これらには一切変更を加えません。** Secrets も共有しません。

> **Private 推奨の理由**：EFK CAMERA 自体に秘密情報は入りませんが、
> 「PINペアリングの実装」「LAN内サーバの仕様」が公開されると
> 攻撃者に手の内を明かすことになります。運用上のリスクを下げるため Private を推奨します。

#### 11.3.2 ディレクトリ構成

```
efk-camera/
├─ .github/
│  └─ workflows/
│     ├─ android-ci.yml        # push / PR ごと：ビルド・テスト・Lint・Secret検査
│     └─ release.yml           # タグ v* ：署名付きAPKを作って Release に添付
├─ .gitignore
├─ README.md                   # ビルド手順・インストール手順・テスト手順
├─ SETUP_GOOGLE_CLOUD.md       # つるさん向け Google Cloud 設定手順（全9ステップ）
├─ OPERATIONS.md               # 試合当日の運用手順・トラブル対応
├─ SECURITY.md                 # Secrets 方針・脅威モデル
├─ docs/
│  └─ EFK_CAMERA_v1_技術設計書.md   # 本書
├─ gradle/
│  ├─ libs.versions.toml       # 依存バージョンを1か所に固定（★重要）
│  └─ wrapper/                 # gradle-wrapper.jar / .properties（★コミットする）
├─ gradlew / gradlew.bat
├─ settings.gradle.kts
├─ build.gradle.kts
├─ gradle.properties
├─ keystore.properties.example # 実物は絶対にコミットしない
└─ app/
   ├─ build.gradle.kts
   ├─ proguard-rules.pro
   └─ src/
      ├─ main/
      │  ├─ AndroidManifest.xml
      │  ├─ java/jp/efk/camera/…
      │  ├─ res/…
      │  └─ assets/web/        # 操作画面（index.html / app.js / style.css）
      └─ test/java/jp/efk/camera/…   # Unit Test（JVM上で動く＝CIで必ず回る）
```

#### 11.3.3 ブランチ方針

2人以下の体制なので、**あえて簡素にします**（GitFlow は採用しません）。

```
main            ← 常にビルドが通る状態だけを置く。ここにタグを打ってリリース
 ├─ feat/xxx    ← 機能追加
 ├─ fix/xxx     ← 不具合修正
 └─ docs/xxx    ← ドキュメントのみ
```

- `main` への直接 push は禁止し、**PR 経由のみ**にします
- `main` に **ブランチ保護**をかけ、**CI が緑でないとマージできない**設定にします
  （= 「ローカルでは動くが GitHub では壊れている」が main に入らない）
- タグ `v1.0.0` を打つと署名付き APK が自動生成されます
- 実機に入れた APK がどのコミットか分かるよう、
  **アプリ内に `versionName + gitハッシュ` を表示**します（不具合報告のとき重要）

### 11.4 .gitignore（Secrets 混入をまず物理的に防ぐ）

```gitignore
# --- 秘密情報（絶対にコミットしない） ---
local.properties
keystore.properties
*.jks
*.keystore
*.p12
*.pem
google-services.json
client_secret*.json
service-account*.json
.env
.env.*
!.env.example
**/secrets/**
*token*.txt
*credential*.json

# --- ビルド成果物 ---
build/
.gradle/
*.apk
*.aab
*.ap_
*.dex
captures/
.cxx/

# --- IDE / OS ---
.idea/
*.iml
.DS_Store
```

`local.properties` は Android SDK のパスが入るだけですが、
**マシン固有のパスが混ざると CI が壊れる**ので必ず除外します。

### 11.5 Secrets 管理方針

#### 11.5.1 まず「そもそも秘密情報がほとんど無い」設計にした

これが本設計のいちばん効いている部分です。

| 依頼で挙がっていた Credential | このアプリでの扱い |
|---|---|
| Google OAuth **Client Secret** | **存在しません。** Android 型の OAuth クライアントは client secret を発行しません（パッケージ名 + 署名SHA-1 で本人確認するため） |
| **アクセストークン** | アプリは保存しません。Play 開発者サービスが都度発行し、メモリ上でのみ使用 |
| **リフレッシュトークン** | **アプリは一切受け取りません**（Play 開発者サービス方式のため） |
| YouTube 認証情報 | 同上。端末の Google アカウントに紐づくのみ |
| Google Cloud 秘密情報 | プロジェクトID・クライアントIDは**秘密ではない**（公開情報）。秘密鍵は使いません |
| 端末固有の秘密情報（PIN / ペアリングトークン） | 端末内 `SharedPreferences` で**実行時に生成**。ソースにもGitにも存在しない |
| **署名用キーストア** | **唯一の本物の秘密**。次項で管理します |

つまり **リポジトリに入れなければならない秘密は 0 件**です。
CI が署名 APK を作るときだけ、キーストアが必要になります。

#### 11.5.2 キーストアの管理

```
ローカル： efk-camera-release.jks  ← つるさんのPCとクラウドに厳重保管（失うと更新配布できません）
           keystore.properties     ← パスワードを書く。.gitignore 済み

GitHub  ： Settings → Secrets and variables → Actions に4件登録
           ANDROID_KEYSTORE_BASE64    （jks を base64 にした文字列）
           ANDROID_KEYSTORE_PASSWORD
           ANDROID_KEY_ALIAS
           ANDROID_KEY_PASSWORD
```

- GitHub Secrets は暗号化保存され、**ログには自動でマスク**されます
- この4件は **EFK CAMERA リポジトリ専用**に登録します（他案件と共有しません）
- Organization レベルの Secrets は使いません（他案件に漏れるため）
- `build.gradle.kts` は「`keystore.properties` があれば署名、無ければ debug 署名」と書き、
  **キーストアが無い環境でもビルドが落ちないように**します（＝ CI の debug ビルドは常に通る）

#### 11.5.3 ログに Secrets を残さない仕組み

依頼の「ログ・テストデータ・エラー出力にも Secrets が残らないように」への対応として、
**`SafeLog` というログラッパーを作り、アプリ内では `android.util.Log` を直接使いません。**

自動でマスクする対象：

| 対象 | マスク後の例 |
|---|---|
| `Authorization: Bearer ya29.…` | `Bearer ***` |
| YouTube の resumable upload URL（`upload_id` を含む） | `https://…/videos?…upload_id=***` |
| ペアリング PIN | `******` |
| ペアリングトークン | `tok_***` |
| Google アカウントのメールアドレス | `emf***@gmail.com` |

さらに CI で **「`Log.d(` / `Log.e(` などの直接呼び出しが増えていないか」**を検査し、
増えていたら失敗させます（うっかり生ログを足すのを防ぐ）。

リリースビルドでは ProGuard でデバッグログ自体を削除します。

#### 11.5.4 CI での Secret 混入検査

`android-ci.yml` に以下を入れます。

1. **gitleaks**（`gitleaks/gitleaks-action`）で履歴と差分をスキャン
2. **追跡禁止ファイルの検査** — 下記が `git ls-files` に出たら即失敗

   ```
   *.jks / *.keystore / keystore.properties / local.properties
   google-services.json / client_secret*.json / .env
   ```
3. **高エントロピー文字列の簡易検査** — `ya29.` `AIza` `-----BEGIN` `1//0` などのパターン

GitHub 側でも **Secret scanning と Push protection を有効化**していただきます
（Private リポジトリでも無料で使えます。手順は SECURITY.md に記載）。

### 11.6 CI 内容

#### 11.6.1 `android-ci.yml`（push / PR のたびに実行）

| # | ステップ | 落とす条件 |
|---|---|---|
| 1 | Checkout | — |
| 2 | JDK 17 (Temurin) セットアップ | — |
| 3 | Android SDK セットアップ | — |
| 4 | Gradle キャッシュ | — |
| 5 | **Secret 混入検査**（11.5.4） | 秘密らしきものを検出 |
| 6 | `./gradlew lintDebug` | Lint エラー |
| 7 | `./gradlew testDebugUnitTest` | Unit Test 失敗 |
| 8 | `./gradlew assembleDebug` | **ビルド失敗** |
| 9 | 依存関係レポート出力 | — |
| 10 | debug APK をアーティファクトとして保存（14日） | — |

**実機がなくても壊れを検知できるよう、ロジックを JVM 上の Unit Test に切り出します。**
最初から入れるテスト：

- タイトル生成（`2026-09-17 GRTIA CUP U18 vs ○○高校` になるか、分割時の `(1/2)`）
- **削除安全条件の判定関数**（VERIFIED 以外では絶対に true を返さないこと）★最重要
- 再開可能アップロードの `Content-Range` 組み立てと 308 レスポンス解釈
- プライベートIP判定（`192.168.1.5` は許可 / `8.8.8.8` は拒否）
- ストレージ所要容量の計算
- `SafeLog` のマスク処理
- ペアリングのレート制限（5回で10分ロック）

#### 11.6.2 「ローカルでは動くが GitHub では動かない」を防ぐ4つの約束

| 対策 | 内容 |
|---|---|
| **Gradle Wrapper をコミット** | `gradlew` と `gradle-wrapper.jar` を必ずコミット。ローカルと CI で**同一バージョンの Gradle** が動く |
| **バージョン完全固定** | `gradle/libs.versions.toml` に全依存を固定。`1.4.+` のような動的バージョンを禁止 |
| **JVM ツールチェーン固定** | `jvmToolchain(17)` を宣言。手元が JDK 21 でも CI が JDK 17 でも**同じバイトコード**になる |
| **CI と同じコマンドを README に書く** | ローカルでも `./gradlew lintDebug testDebugUnitTest assembleDebug` を実行してから push |

#### 11.6.3 CI 結果の扱い

- **CI が赤いまま「完成」とは報告しません。**
- push 後は必ず Actions の結果を確認し、失敗したら原因を直して再 push します
- 直せない・仕様判断が要る失敗は、**推測で回避せずご相談**します

### 11.7 ビルド方法・APK 生成・リリース方法

#### 11.7.1 ローカルビルド（つるさんのPC）

```bash
git clone https://github.com/nasimentozisan-svg/efk-camera.git
cd efk-camera

# デバッグ版（テスト用・すぐ入れられる）
./gradlew assembleDebug
# → app/build/outputs/apk/debug/app-debug.apk

# KYV47 へインストール（USBデバッグON）
adb install -r app/build/outputs/apk/debug/app-debug.apk
```

Android Studio を使う場合は、フォルダを開いて ▶ を押すだけです。

#### 11.7.2 リリース版 APK

```bash
# 初回のみ：署名鍵を作る（有効期限は長めに）
keytool -genkeypair -v -keystore efk-camera-release.jks \
  -alias efkcamera -keyalg RSA -keysize 2048 -validity 10000

cp keystore.properties.example keystore.properties
# keystore.properties にパスワードとパスを記入（このファイルはコミットされません）

./gradlew assembleRelease
# → app/build/outputs/apk/release/app-release.apk
```

#### 11.7.3 GitHub からのリリース（推奨）

```bash
git tag v1.0.0
git push origin v1.0.0
```

`release.yml` が自動で
**署名付き APK をビルド → GitHub Releases に添付**します。
つるさんは Releases ページから APK をダウンロードして KYV47 に入れるだけです。

#### 11.7.4 ★ 見落としやすい落とし穴（必ず対応します）

> **Google Cloud の OAuth クライアントには、
> debug 用と release 用の SHA-1 を「両方」登録する必要があります。**

debug ビルドと release ビルドでは署名鍵が違うため SHA-1 が変わり、
片方しか登録していないと **「release APK にすると YouTube 認証だけが失敗する」**
という分かりにくい事故が起きます。

SETUP_GOOGLE_CLOUD.md に、両方の SHA-1 を取得するコマンドと
登録手順を明記します。

```bash
./gradlew signingReport   # debug と release の SHA-1 が両方出ます
```

### 11.8 Vercel についての判断

#### 11.8.1 結論：**EFK CAMERA v1 では Vercel を使用しません。**

必要になり得た用途を1つずつ検討した結果です。

| 想定用途 | v1 での判断 | 理由 |
|---|---|---|
| 操作画面（HTML/JS）の配信 | **不要** | APK に同梱し KYV47 が配信。**むしろクラウド配信だと体育館のネットが切れた瞬間に操作画面が開けなくなる**（ご指示の主旨に反する） |
| 外から KYV47 を操作するための中継 | **不要かつ非推奨** | NAT 越えの常時接続が必要になり、構成も攻撃面も一気に増える。同一LAN限定が最も安全で確実 |
| OAuth のリダイレクト受け口 | **不要** | Play 開発者サービス方式のため Web リダイレクトが発生しない |
| 撮影履歴・アップロード履歴の共有 | **v1 では不要** | まず端末内で持つ。チーム共有が必要になったら v2 で検討 |
| 複数カメラの一括管理 | **v1 では不要** | 将来拡張。その場合も録画制御は LAN 内で完結させる方針は変えない |

**つまり、いま Vercel を入れると「得るものが無く、依存先と障害点だけが増える」**ため使用しません。

#### 11.8.2 既存の Vercel 環境について

- 今回のセッションで **Vercel に対する操作は一切行っていません**（確認・変更とも）
- 既存の EFK AI COMPANY の Vercel プロジェクト、ドメイン、環境変数には
  **追加も変更も行いません**
- EFK CAMERA は Vercel プロジェクトを新規作成もしません

#### 11.8.3 将来 Vercel が必要になった場合に、先に整理すべき項目

v2 以降で「撮影履歴をチームで共有したい」等が出てきた場合、
実装前に以下を文書化してからご相談します（ご指示の項目に対応）。

| 項目 | 事前に確定させること |
|---|---|
| 目的 | 何ができるようになるのか。端末内で代替できないか |
| **録画への影響** | **Vercel が落ちても録画・停止・保存が100%動くこと（必須条件）** |
| プラン | **Hobby プランは商用利用不可**。クラブ運営での利用形態を確認し、必要なら Pro |
| 商用利用条件 | 利用規約の該当条項を確認 |
| 環境変数 | 何を置くか。**EFK CAMERA 専用プロジェクトに限定**し既存と共有しない |
| GitHub 連携 | `efk-camera` リポジトリ**のみ**を連携。既存連携に触れない |
| デプロイ設定 | ブランチ・ビルドコマンド・出力先 |
| URL | 新規サブドメイン。**既存ドメインに影響しないこと** |
| セキュリティ | 認証方式・アクセス制御・保存するデータの範囲 |
| 障害時の影響 | 使えなくなる機能の一覧と代替手段 |
| ロールバック | 直前デプロイへの戻し方 |

### 11.9 本番設定を変更する前の安全確認フロー

GitHub / Google Cloud / YouTube / Vercel に対して本番変更を行う場合、
**必ず次の5段階を踏み、勝手に実行しません。**

```
① 現状確認   いまどうなっているかを読み取って提示する
② 影響確認   既存の何に影響しうるかを列挙する
③ 変更提示   何をどう変えるかを、実行前に文章で提示して承認を得る
④ テスト     変更後に何を確認すれば成功と言えるかを決めておく
⑤ 戻し方     失敗したときにどう戻すかを、先に確定させる
```

v1 で実際に本番変更が発生するのは **Google Cloud の設定だけ**です。
その5段階は以下のとおりです。

| 段階 | 内容 |
|---|---|
| ① 現状確認 | `emfrentekumamoto@gmail.com` に既存の Google Cloud プロジェクトがあるか確認 |
| ② 影響確認 | **既存プロジェクトは使わず、EFK CAMERA 専用プロジェクトを新規作成**するので、既存への影響ゼロ |
| ③ 変更提示 | SETUP_GOOGLE_CLOUD.md に全9ステップを画面名つきで明示 |
| ④ テスト | アプリでサインイン → テスト用の短い動画を1本アップロード → Video ID が返るか確認 |
| ⑤ 戻し方 | 専用プロジェクトを削除すれば完全に元通り（他に影響しない） |

GitHub のリポジトリ新設・ブランチ保護設定についても同様に、
**実行前に内容を提示して承認をいただいてから**行います。

### 11.10 いま時点での「触っていないこと」の明示

| 対象 | 状態 |
|---|---|
| Vercel | **一切操作していません**（確認・変更とも） |
| 既存 GitHub リポジトリ（8件） | **一切変更していません** |
| Google Cloud / YouTube | **一切操作していません** |
| `cloudcode` リポジトリ | 作業ブランチ `claude/efk-camera-v1-design-ydp96a` に本設計書を追加したのみ。`main` および TAC view のコードには触れていません |

---

## 12. ご確認・ご判断をお願いしたいこと

実装に入る前に、下記だけご回答ください。**Q1 と Q2 が特に重要です。**

### Q1. リポジトリをどうしますか？（最重要）

ご指示は「EFK CAMERA 専用リポジトリとして独立管理」でした。一方、
現在の作業指定は `cloudcode`（**Public** かつ TAC view が同居）のブランチです。

| 選択肢 | 内容 | おすすめ |
|---|---|---|
| **A** | **`efk-camera` を Private で新規作成**し、そちらに実装する | ★ ご指示に最も忠実 |
| B | いったん `cloudcode` の作業ブランチに実装し、動作確認後に専用リポジトリへ移す | 段階的だが二度手間 |
| C | `cloudcode` の `efk-camera/` 配下でこのまま進める | ご指示の「混在させない」に反します |

**A を推奨します。** リポジトリ新設は本番変更にあたるため、
ご承認をいただいてから作成します（作成後、既存8リポジトリには影響しません）。

### Q2. KYV47 の Android バージョンは？

`設定 → 端末情報 → Android バージョン` の数字を教えてください。
（8.0 以上ならこのまま進められます）

### Q3. 録画の音声は必要ですか？

| 選択肢 | 備考 |
|---|---|
| あり（推奨） | 声かけ・笛が入る。マイク権限が必要 |
| なし | 権限が1つ減り、わずかに安定側に倒れる |

### Q4. アップロードはテザリングでも実行しますか？

1試合で **約 2.4GB** 通信します。

| 選択肢 | 備考 |
|---|---|
| Wi-Fi のときだけ（推奨） | 帰宅後や自宅Wi-Fiで自動アップロード。ギガを消費しない |
| 回線を問わず即座に | 試合直後に上がるが、テザリングだとギガを大量消費 |

（アプリ内の設定でいつでも切り替えられるようにします。初期値だけ決めてください）

### Q5. 撮影は 1080p でよいですか？

初期値は **1080p / 30fps / 8Mbps** を想定しています。
40分テストで発熱やコマ落ちが出た場合は 720p へ落とせます。
（アプリ内の設定で切り替え可能）

---

## 付録A：API エンドポイント一覧

| メソッド | パス | 認証 | 内容 |
|---|---|---|---|
| GET | `/` | 不要 | 操作UI |
| GET | `/style.css` `/app.js` | 不要 | 静的ファイル |
| POST | `/api/pair` | PIN | `{pin}` → `{token}` |
| GET | `/api/status` | Token | 全状態 |
| POST | `/api/record/start` | Token | `{title}` |
| POST | `/api/record/stop` | Token | — |
| GET | `/api/preview.mjpg` | Token(query) | MJPEG ストリーム |
| POST | `/api/settings` | Token | `{quality, splitMinutes, audio, preview}` |
| POST | `/api/uploads/retry` | Token | `{id}` |
| POST | `/api/uploads/delete` | Token | `{id, confirm}` |

## 付録B：状態 JSON の例

```json
{
  "device": { "name": "KYV47", "model": "KYV47", "androidSdk": 28 },
  "battery": { "percent": 82, "charging": true, "temperatureC": 33.5 },
  "storage": { "freeBytes": 33285996544, "recordableMinutes": 554 },
  "camera": { "ready": true, "previewAvailable": true, "quality": "FHD", "bitrateMbps": 8 },
  "recording": {
    "state": "RECORDING",
    "title": "GRTIA CUP U18 vs ○○高校",
    "startedAtEpochMs": 1789628400000,
    "elapsedMs": 1122000,
    "part": 1,
    "bytesRecorded": 1122000000
  },
  "google": { "signedIn": true, "account": "emfrentekumamoto@gmail.com" },
  "uploads": [
    {
      "id": "20260917-134500",
      "title": "2026-09-17 GRTIA CUP U18 vs ○○高校",
      "state": "UPLOADING",
      "progress": 0.35,
      "videoId": null,
      "url": null,
      "privacyStatus": null,
      "sizeBytes": 2400000000,
      "error": null
    }
  ],
  "warnings": [
    { "level": "warn", "message": "電池温度が42℃です。プレビューを停止しました" }
  ]
}
```
