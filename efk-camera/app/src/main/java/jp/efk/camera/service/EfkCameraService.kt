package jp.efk.camera.service

import android.app.Notification
import android.content.Context
import android.content.Intent
import android.content.IntentFilter
import android.Manifest
import android.content.pm.PackageManager
import android.content.pm.ServiceInfo
import android.net.wifi.WifiManager
import android.os.BatteryManager
import android.os.Build
import android.os.IBinder
import android.os.PowerManager
import android.os.SystemClock
import androidx.core.app.NotificationCompat
import androidx.core.app.ServiceCompat
import androidx.core.content.ContextCompat
import androidx.lifecycle.lifecycleScope
import androidx.lifecycle.LifecycleService
import jp.efk.camera.BuildConfig
import jp.efk.camera.EfkApp
import jp.efk.camera.EfkServiceLocator
import jp.efk.camera.MainActivity
import jp.efk.camera.auth.GoogleAuthManager
import jp.efk.camera.camera.CameraController
import jp.efk.camera.camera.PreviewHub
import jp.efk.camera.core.AppState
import jp.efk.camera.core.BatteryInfo
import jp.efk.camera.core.Prefs
import jp.efk.camera.core.RecState
import jp.efk.camera.core.StorageInfo
import jp.efk.camera.core.ThermalGuard
import jp.efk.camera.core.Warning
import jp.efk.camera.server.ControlServer
import jp.efk.camera.server.NetworkUtils
import jp.efk.camera.store.DeletionGuard
import jp.efk.camera.store.OrphanScanner
import jp.efk.camera.store.UploadState
import jp.efk.camera.store.VideoStore
import jp.efk.camera.upload.UploadScheduler
import jp.efk.camera.util.Fmt
import jp.efk.camera.util.SafeLog
import jp.efk.camera.util.StoragePlanner
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.delay
import kotlinx.coroutines.isActive
import kotlinx.coroutines.launch
import org.json.JSONObject
import java.io.File

/**
 * カメラ・録画・端末内HTTPサーバをまとめて保持する常駐サービス。
 *
 * ★ このサービスだけが AppState を更新する（設計書 8.2）。
 * ★ 操作端末との接続状態は録画制御に一切影響しない。
 */
class EfkCameraService : LifecycleService(), ControlServer.Host {

    private lateinit var prefs: Prefs
    private lateinit var store: VideoStore
    private lateinit var auth: GoogleAuthManager

    private var camera: CameraController? = null
    private var server: ControlServer? = null

    private var wakeLock: PowerManager.WakeLock? = null
    private var wifiLock: WifiManager.WifiLock? = null

    private var monitorStarted = false

    override fun onCreate() {
        super.onCreate()
        prefs = Prefs.get(this)
        store = VideoStore.get(this)
        auth = GoogleAuthManager(this)
        auth.publish()

        AppState.update {
            it.copy(
                deviceName = prefs.deviceName,
                model = Build.MODEL ?: "",
                sdkInt = Build.VERSION.SDK_INT,
                versionName = BuildConfig.VERSION_NAME,
                gitSha = BuildConfig.GIT_SHA,
                serverPort = prefs.serverPort,
            )
        }

        startAsForeground()

        val controller = CameraController(
            context = this,
            lifecycleOwner = this,
            onSessionFinished = { sessionId, ids -> onSessionFinished(sessionId, ids) },
        )
        camera = controller
        EfkServiceLocator.previewHub = controller.previewHub
        controller.start()

        // 異常終了の取り残しを拾う（自動削除はしない）
        OrphanScanner.scan(controller.recordingDir(), store)

        startServer()
        startMonitor()
        UploadScheduler.enqueue(this, "サービス起動")
    }

    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        super.onStartCommand(intent, flags, startId)
        when (intent?.action) {
            ACTION_START_RECORDING -> {
                val name = intent.getStringExtra(EXTRA_MATCH_NAME).orEmpty()
                startRecording(name)
            }
            ACTION_STOP_RECORDING -> stopRecording()
            ACTION_RESTART_CAMERA -> camera?.rebind()
        }
        // 強制終了されても OS に復活させる
        return START_STICKY
    }

    override fun onBind(intent: Intent): IBinder? {
        super.onBind(intent)
        return null
    }

    override fun onDestroy() {
        SafeLog.i(TAG, "サービスを終了します")
        releaseLocks()
        server?.stop()
        server = null
        camera?.shutdown()
        camera = null
        EfkServiceLocator.previewHub = null
        super.onDestroy()
    }

    // ------------------------------------------------------------------
    // サーバ
    // ------------------------------------------------------------------

    private fun startServer() {
        try {
            val s = ControlServer(this, prefs.serverPort, this)
            s.start(SERVER_TIMEOUT_MS, false)
            server = s
            AppState.update {
                it.copy(
                    serverRunning = true,
                    serverPort = prefs.serverPort,
                    serverUrls = NetworkUtils.localIpv4Addresses()
                        .map { ip -> "http://$ip:${prefs.serverPort}" },
                )
            }
            SafeLog.i(TAG, "操作サーバを開始しました port=${prefs.serverPort}")
        } catch (e: Exception) {
            SafeLog.e(TAG, "操作サーバを開始できませんでした", e)
            AppState.update { it.copy(serverRunning = false) }
        }
    }


    // ------------------------------------------------------------------
    // ControlServer.Host
    // ------------------------------------------------------------------

    override fun startRecording(matchName: String): String? {
        val controller = camera ?: return "カメラの準備ができていません"
        val failure = controller.startRecording(matchName)
        if (failure == null) {
            acquireLocks()
            updateNotification()
        }
        return failure
    }

    override fun stopRecording(): String? {
        val controller = camera ?: return "カメラの準備ができていません"
        return controller.stopRecording()
    }

    override fun applySettings(body: JSONObject): String? {
        if (AppState.isRecording) return "録画中は設定を変更できません"
        var needsRebind = false

        if (body.has("quality")) {
            val q = body.optString("quality")
            if (q != Prefs.Q_FHD && q != Prefs.Q_HD) return "解像度の指定が不正です"
            if (q != prefs.quality) {
                prefs.quality = q
                needsRebind = true
            }
        }
        if (body.has("audioEnabled")) prefs.audioEnabled = body.optBoolean("audioEnabled", true)
        if (body.has("previewEnabled")) prefs.previewEnabled = body.optBoolean("previewEnabled", true)
        if (body.has("splitMinutes")) prefs.splitMinutes = body.optInt("splitMinutes", 0)
        if (body.has("orientation")) {
            val o = body.optString("orientation")
            if (o !in setOf(Prefs.O_LAND_A, Prefs.O_LAND_B, Prefs.O_PORTRAIT)) {
                return "映像の向きの指定が不正です"
            }
            if (o != prefs.orientation) {
                prefs.orientation = o
                needsRebind = true
            }
        }
        if (body.has("wifiOnlyUpload")) {
            prefs.wifiOnlyUpload = body.optBoolean("wifiOnlyUpload", true)
            UploadScheduler.reschedule(this)
        }

        if (needsRebind) camera?.rebind()
        refreshStorage()
        return null
    }

    override fun retryUpload(id: String): String? {
        val record = store.get(id) ?: return "対象が見つかりません"
        if (!record.holdsFile) return "元動画がすでにありません"
        if (!File(record.filePath).exists()) return "録画ファイルが見つかりません"
        store.update(id) {
            it.copy(state = UploadState.PENDING_UPLOAD, lastError = null, orphan = false)
        }
        UploadScheduler.enqueue(this, "手動の再試行")
        return null
    }

    override fun deleteRecord(id: String, confirmed: Boolean): String? {
        val record = store.get(id) ?: return "対象が見つかりません"
        if (DeletionGuard.manualDeleteNeedsWarning(record) && !confirmed) {
            return DeletionGuard.manualDeleteWarningText(record)
        }
        val file = File(record.filePath)
        if (file.exists() && !file.delete()) return "ファイルを削除できませんでした"
        store.update(id) {
            it.copy(
                state = if (it.state == UploadState.VERIFIED || it.state == UploadState.DONE) {
                    UploadState.DONE
                } else {
                    it.state
                },
                fileDeletedAtEpochMs = System.currentTimeMillis(),
            )
        }
        SafeLog.i(TAG, "手動で削除しました id=$id")
        return null
    }

    override fun previewHub(): PreviewHub? {
        val controller = camera ?: return null
        if (!AppState.current.camera.previewAvailable) return null
        if (!prefs.previewEnabled || ThermalGuard.previewBlocked) return null
        return controller.previewHub
    }

    // ------------------------------------------------------------------
    // 録画終了後の処理
    // ------------------------------------------------------------------

    private fun onSessionFinished(sessionId: String, recordIds: List<String>) {
        releaseLocks()
        updateNotification()
        if (recordIds.isEmpty()) {
            SafeLog.w(TAG, "録画ファイルが作られませんでした session=$sessionId")
            return
        }
        UploadScheduler.enqueue(this, "録画終了")
    }

    // ------------------------------------------------------------------
    // 監視ループ
    // ------------------------------------------------------------------

    private fun startMonitor() {
        if (monitorStarted) return
        monitorStarted = true
        lifecycleScope.launch(Dispatchers.Default) {
            while (isActive) {
                runCatching { tick() }
                    .onFailure { SafeLog.w(TAG, "状態の更新に失敗しました", it) }
                delay(MONITOR_INTERVAL_MS)
            }
        }
    }

    private fun tick() {
        refreshBattery()
        refreshStorage()
        refreshWarnings()
        updateNotification()
    }

    private fun refreshBattery() {
        val intent = ContextCompat.registerReceiver(
            this,
            null,
            IntentFilter(Intent.ACTION_BATTERY_CHANGED),
            ContextCompat.RECEIVER_NOT_EXPORTED,
        ) ?: return
        val level = intent.getIntExtra(BatteryManager.EXTRA_LEVEL, -1)
        val scale = intent.getIntExtra(BatteryManager.EXTRA_SCALE, -1)
        val percent = if (level >= 0 && scale > 0) level * 100 / scale else -1
        val status = intent.getIntExtra(BatteryManager.EXTRA_STATUS, -1)
        val charging = status == BatteryManager.BATTERY_STATUS_CHARGING ||
            status == BatteryManager.BATTERY_STATUS_FULL
        // API 28 では ThermalStatus が使えないため電池温度で代用する（設計書 6.4）
        val tempC = intent.getIntExtra(BatteryManager.EXTRA_TEMPERATURE, 0) / 10.0f

        ThermalGuard.onTemperature(tempC)
        AppState.update {
            it.copy(battery = BatteryInfo(percent, charging, tempC))
        }
    }

    private fun refreshStorage() {
        val dir = camera?.recordingDir() ?: return
        val free = dir.usableSpace
        val total = dir.totalSpace
        val minutes = StoragePlanner.recordableMinutes(free, prefs.videoBitrate, prefs.audioEnabled)
        AppState.update {
            it.copy(
                storage = StorageInfo(free, total, minutes),
                camera = it.camera.copy(
                    quality = prefs.quality,
                    bitrateBps = prefs.videoBitrate,
                    previewAvailable = it.camera.previewAvailable && !ThermalGuard.previewBlocked,
                ),
                serverUrls = if (it.serverUrls.isEmpty()) {
                    NetworkUtils.localIpv4Addresses().map { ip -> "http://$ip:${prefs.serverPort}" }
                } else {
                    it.serverUrls
                },
            )
        }
    }

    private fun refreshWarnings() {
        val s = AppState.current
        val warnings = mutableListOf<Warning>()

        if (!s.camera.ready) {
            warnings += Warning(Warning.ERROR, s.camera.error ?: "カメラを利用できません")
        }
        if (s.battery.percent in 0..9 && !s.battery.charging) {
            warnings += Warning(Warning.ERROR, "電池残量が${s.battery.percent}%です。すぐに充電してください")
        } else if (s.battery.percent in 10..19 && !s.battery.charging) {
            warnings += Warning(Warning.WARN, "電池残量が${s.battery.percent}%です。充電を推奨します")
        }
        if (s.battery.temperatureC >= ThermalGuard.HOT_C) {
            warnings += Warning(
                Warning.ERROR,
                "電池温度が${"%.1f".format(s.battery.temperatureC)}℃です。" +
                    "録画は継続していますが、日陰へ移すなど冷却してください",
            )
        } else if (s.battery.temperatureC >= ThermalGuard.WARN_C) {
            warnings += Warning(
                Warning.WARN,
                "電池温度が${"%.1f".format(s.battery.temperatureC)}℃です。" +
                    "負荷を下げるためプレビューを停止しました",
            )
        }
        if (s.storage.recordableMinutes < 60) {
            warnings += Warning(
                Warning.WARN,
                "空き容量で録画できるのは約${s.storage.recordableMinutes}分です",
            )
        }
        if (!s.google.signedIn) {
            warnings += Warning(
                Warning.WARN,
                "Google アカウントが未設定です。録画はできますが、自動アップロードされません",
            )
        }
        val holding = store.all().count { it.holdsFile && it.state != UploadState.DONE }
        if (holding > 0) {
            warnings += Warning(Warning.INFO, "未アップロードの動画が${holding}件あります")
        }
        val failed = store.all().count { it.state == UploadState.FAILED_PERMANENT }
        if (failed > 0) {
            warnings += Warning(
                Warning.ERROR,
                "アップロードに失敗した動画が${failed}件あります。削除しないでください",
            )
        }

        AppState.update { it.copy(warnings = warnings) }
    }

    // ------------------------------------------------------------------
    // ロック・通知
    // ------------------------------------------------------------------

    @Suppress("DEPRECATION")
    private fun acquireLocks() {
        try {
            if (wakeLock == null) {
                val pm = getSystemService(Context.POWER_SERVICE) as PowerManager
                wakeLock = pm.newWakeLock(PowerManager.PARTIAL_WAKE_LOCK, WAKE_TAG)
            }
            wakeLock?.takeIf { !it.isHeld }?.acquire(MAX_LOCK_MS)

            if (wifiLock == null) {
                val wm = applicationContext.getSystemService(Context.WIFI_SERVICE) as WifiManager
                wifiLock = wm.createWifiLock(WifiManager.WIFI_MODE_FULL_HIGH_PERF, WIFI_TAG)
            }
            wifiLock?.takeIf { !it.isHeld }?.acquire()
        } catch (e: Exception) {
            SafeLog.w(TAG, "ロックの取得に失敗しました", e)
        }
    }

    private fun releaseLocks() {
        runCatching { wakeLock?.takeIf { it.isHeld }?.release() }
        runCatching { wifiLock?.takeIf { it.isHeld }?.release() }
    }

    /**
     * API 34 以降はフォアグラウンドサービスの種別を明示する必要がある。
     * 権限が無い種別を宣言すると例外になるため、実際に許可されている分だけ立てる。
     */
    private fun startAsForeground() {
        try {
            ServiceCompat.startForeground(this, NOTIFICATION_ID, buildNotification(), fgsType())
        } catch (e: Exception) {
            SafeLog.e(TAG, "フォアグラウンド化に失敗しました", e)
        }
    }

    private fun fgsType(): Int {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.Q) return 0
        var type = 0
        if (granted(Manifest.permission.CAMERA)) {
            type = type or ServiceInfo.FOREGROUND_SERVICE_TYPE_CAMERA
        }
        if (granted(Manifest.permission.RECORD_AUDIO)) {
            type = type or ServiceInfo.FOREGROUND_SERVICE_TYPE_MICROPHONE
        }
        return type
    }

    private fun granted(permission: String): Boolean =
        ContextCompat.checkSelfPermission(this, permission) == PackageManager.PERMISSION_GRANTED

    private fun updateNotification() {
        runCatching {
            EfkApp.notificationManager(this).notify(NOTIFICATION_ID, buildNotification())
        }
    }

    private fun buildNotification(): Notification {
        val s = AppState.current
        val rec = s.recording
        val text = when (rec.state) {
            RecState.RECORDING -> {
                val elapsed = SystemClock.elapsedRealtime() - rec.startedAtElapsedRealtime
                "REC ${Fmt.duration(elapsed)}  " + (rec.matchName ?: "")
            }
            RecState.STARTING -> "録画を開始しています"
            RecState.STOPPING -> "録画を終了しています"
            RecState.ERROR -> rec.error ?: "エラーが発生しました"
            RecState.IDLE -> {
                val url = s.serverUrls.firstOrNull()
                if (s.serverRunning && url != null) "待機中  $url" else "待機中"
            }
        }
        return NotificationCompat.Builder(this, EfkApp.CHANNEL_SERVICE)
            .setContentTitle("EFK CAMERA")
            .setContentText(text)
            .setSmallIcon(android.R.drawable.presence_video_online)
            .setOngoing(true)
            .setOnlyAlertOnce(true)
            .setContentIntent(MainActivity.pendingIntent(this))
            .build()
    }

    companion object {
        private const val TAG = "Service"
        private const val NOTIFICATION_ID = 1001
        private const val SERVER_TIMEOUT_MS = 10_000
        private const val MONITOR_INTERVAL_MS = 3_000L
        private const val WAKE_TAG = "EfkCamera::recording"
        private const val WIFI_TAG = "EfkCamera::wifi"

        /** 想定最長（3時間）を超えたらロックを自動解放させる保険。 */
        private const val MAX_LOCK_MS = 3L * 60 * 60 * 1000

        const val ACTION_START_RECORDING = "jp.efk.camera.START_RECORDING"
        const val ACTION_STOP_RECORDING = "jp.efk.camera.STOP_RECORDING"
        const val ACTION_RESTART_CAMERA = "jp.efk.camera.RESTART_CAMERA"
        const val EXTRA_MATCH_NAME = "match_name"

        fun start(context: Context) {
            val intent = Intent(context, EfkCameraService::class.java)
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                context.startForegroundService(intent)
            } else {
                context.startService(intent)
            }
        }
    }
}
