package jp.efk.camera.core

import android.content.Context
import android.content.SharedPreferences
import android.os.Build

/**
 * 設定の永続化。
 *
 * ここに保存するのは「設定」と「ペアリングトークン」だけ。
 * Google のアクセストークン／リフレッシュトークンは一切保存しない
 * （Play 開発者サービスが保持する。設計書 5.1）。
 */
class Prefs private constructor(context: Context) {

    private val sp: SharedPreferences =
        context.applicationContext.getSharedPreferences("efk_camera", Context.MODE_PRIVATE)

    // --- 撮影設定 -----------------------------------------------------

    /** "FHD"(1080p) または "HD"(720p)。 */
    var quality: String
        get() = sp.getString(K_QUALITY, Q_FHD) ?: Q_FHD
        set(v) = sp.edit().putString(K_QUALITY, if (v == Q_HD) Q_HD else Q_FHD).apply()

    /** 映像ビットレート(bps)。0 なら解像度から既定値を使う。 */
    var videoBitrateOverride: Int
        get() = sp.getInt(K_BITRATE, 0)
        set(v) = sp.edit().putInt(K_BITRATE, v).apply()

    val videoBitrate: Int
        get() {
            val override = videoBitrateOverride
            if (override > 0) return override
            return if (quality == Q_HD) DEFAULT_BITRATE_HD else DEFAULT_BITRATE_FHD
        }

    var audioEnabled: Boolean
        get() = sp.getBoolean(K_AUDIO, true)
        set(v) = sp.edit().putBoolean(K_AUDIO, v).apply()

    var previewEnabled: Boolean
        get() = sp.getBoolean(K_PREVIEW, true)
        set(v) = sp.edit().putBoolean(K_PREVIEW, v).apply()

    /** 0 = 分割しない。10 / 15 などを入れると、その分数ごとにファイルを分ける。 */
    var splitMinutes: Int
        get() = sp.getInt(K_SPLIT, 0)
        set(v) = sp.edit().putInt(K_SPLIT, v.coerceIn(0, 60)).apply()

    /** "LAND_A" / "LAND_B" / "PORTRAIT"。 */
    var orientation: String
        get() = sp.getString(K_ORIENTATION, O_LAND_A) ?: O_LAND_A
        set(v) = sp.edit().putString(K_ORIENTATION, v).apply()

    // --- アップロード設定 ---------------------------------------------

    /** true なら従量課金でない回線（自宅Wi-Fi等）のときだけアップロードする。 */
    var wifiOnlyUpload: Boolean
        get() = sp.getBoolean(K_WIFI_ONLY, true)
        set(v) = sp.edit().putBoolean(K_WIFI_ONLY, v).apply()

    var googleAccount: String?
        get() = sp.getString(K_ACCOUNT, null)
        set(v) = sp.edit().putString(K_ACCOUNT, v).apply()

    // --- サーバ設定 ---------------------------------------------------

    var serverPort: Int
        get() = sp.getInt(K_PORT, DEFAULT_PORT)
        set(v) = sp.edit().putInt(K_PORT, v).apply()

    var deviceName: String
        get() = sp.getString(K_DEVICE_NAME, null) ?: Build.MODEL ?: "CAMERA"
        set(v) = sp.edit().putString(K_DEVICE_NAME, v).apply()

    /** ペアリング済みトークン（端末内でのみ生成・保持）。 */
    var pairedTokens: Set<String>
        get() = sp.getStringSet(K_TOKENS, emptySet()) ?: emptySet()
        set(v) = sp.edit().putStringSet(K_TOKENS, v).apply()

    // --- 中断復旧用 ---------------------------------------------------

    /** 直前に録画中だったセッションID。異常終了の検知に使う。 */
    var activeSessionId: String?
        get() = sp.getString(K_ACTIVE_SESSION, null)
        set(v) = sp.edit().putString(K_ACTIVE_SESSION, v).apply()

    companion object {
        const val Q_FHD = "FHD"
        const val Q_HD = "HD"

        const val O_LAND_A = "LAND_A"
        const val O_LAND_B = "LAND_B"
        const val O_PORTRAIT = "PORTRAIT"

        /** 1080p30。40分で約2.4GB（設計書 2.2）。 */
        const val DEFAULT_BITRATE_FHD = 8_000_000

        /** 720p30。40分で約1.5GB。 */
        const val DEFAULT_BITRATE_HD = 5_000_000

        const val DEFAULT_PORT = 8080

        private const val K_QUALITY = "quality"
        private const val K_BITRATE = "bitrate"
        private const val K_AUDIO = "audio"
        private const val K_PREVIEW = "preview"
        private const val K_SPLIT = "split_minutes"
        private const val K_ORIENTATION = "orientation"
        private const val K_WIFI_ONLY = "wifi_only_upload"
        private const val K_ACCOUNT = "google_account"
        private const val K_PORT = "server_port"
        private const val K_DEVICE_NAME = "device_name"
        private const val K_TOKENS = "paired_tokens"
        private const val K_ACTIVE_SESSION = "active_session"

        @Volatile
        private var instance: Prefs? = null

        fun get(context: Context): Prefs =
            instance ?: synchronized(this) {
                instance ?: Prefs(context).also { instance = it }
            }
    }
}
