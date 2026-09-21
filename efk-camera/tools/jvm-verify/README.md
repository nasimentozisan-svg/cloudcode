# Android SDK なしで検証する（フォールバック）

**正式な検証は `./gradlew lintDebug testDebugUnitTest assembleDebug`（= CI）です。**
これはそれが動かせない環境（Google のドメインに到達できないネットワーク等）で、
それでも「コンパイルが通るか」「テストが通るか」を確かめるための代替手段です。

## できること / できないこと

| | 内容 |
|---|---|
| ✅ できる | Kotlin 全ファイルのコンパイル、Unit Test の実行 |
| ✅ 本物で検証 | Android フレームワーク（Robolectric の android-all）、NanoHTTPD、OkHttp、ZXing、kotlinx-coroutines、org.json |
| ⚠️ スタブ | AndroidX（CameraX / WorkManager / AppCompat / Lifecycle / Core）。`stubs/` は **形だけを再現したダミー**で、実 API の正しさは保証しない |
| ❌ できない | Lint、リソース・マニフェストのコンパイル、APK 生成、実機動作 |

`stubs/` で検証できるのは **自分たちのコードの整合性**（型・制御フロー・null 安全・
クラス間参照）であって、AndroidX の API 署名の正しさではありません。
署名を確認したいときは androidx の公式ソースを直接見てください。

```
https://raw.githubusercontent.com/androidx/androidx/androidx-main/<パス>
```

## 使い方

```bash
bash tools/jvm-verify/run.sh
```

初回は Kotlin コンパイラ等を約 300MB ダウンロードします（`.jvm-verify-cache/` に保存。gitignore 済み）。
