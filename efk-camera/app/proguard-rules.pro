# NanoHTTPD はリフレクションを使わないが、内部クラス名を保持しておく
-keep class fi.iki.elonen.** { *; }

# OkHttp / Okio
-dontwarn okhttp3.**
-dontwarn okio.**
-dontwarn org.conscrypt.**
-dontwarn org.bouncycastle.**
-dontwarn org.openjsse.**

# ZXing
-dontwarn com.google.zxing.**

# WorkManager のワーカーはリフレクションで生成される
-keep class jp.efk.camera.upload.UploadWorker { <init>(...); }

# ★ リリースビルドではデバッグログを完全に削除する（Secrets がログに残らないように）
-assumenosideeffects class android.util.Log {
    public static int v(...);
    public static int d(...);
    public static int i(...);
}
