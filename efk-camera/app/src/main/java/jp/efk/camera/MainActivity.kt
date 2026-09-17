package jp.efk.camera

import android.Manifest
import android.annotation.SuppressLint
import android.accounts.AccountManager
import android.app.PendingIntent
import android.content.Context
import android.content.Intent
import android.graphics.BitmapFactory
import android.net.Uri
import android.os.Build
import android.os.Bundle
import android.os.PowerManager
import android.os.SystemClock
import android.provider.Settings
import android.widget.Button
import android.widget.EditText
import android.widget.ImageView
import android.widget.TextView
import android.widget.Toast
import androidx.activity.result.contract.ActivityResultContracts
import androidx.appcompat.app.AlertDialog
import androidx.appcompat.app.AppCompatActivity
import androidx.core.content.ContextCompat
import androidx.lifecycle.Lifecycle
import androidx.lifecycle.lifecycleScope
import androidx.lifecycle.repeatOnLifecycle
import jp.efk.camera.auth.GoogleAuthManager
import jp.efk.camera.core.AppState
import jp.efk.camera.core.Prefs
import jp.efk.camera.core.RecState
import jp.efk.camera.core.Status
import jp.efk.camera.server.AuthTokens
import jp.efk.camera.service.EfkCameraService
import jp.efk.camera.store.UploadState
import jp.efk.camera.store.VideoStore
import jp.efk.camera.util.Fmt
import jp.efk.camera.util.QrCode
import jp.efk.camera.util.SafeLog
import kotlinx.coroutines.delay
import kotlinx.coroutines.launch

/**
 * KYV47 本体の画面。
 *
 * ★ 操作端末が使えない状況（LANが落ちた・操作端末の電池切れ）でも
 *   録画を開始・停止できる最後の手段として、本体にもボタンを置く（設計書 11.2）。
 */
class MainActivity : AppCompatActivity() {

    private lateinit var prefs: Prefs
    private lateinit var auth: GoogleAuthManager
    private lateinit var tokens: AuthTokens

    private lateinit var statusText: TextView
    private lateinit var urlText: TextView
    private lateinit var pinText: TextView
    private lateinit var qrImage: ImageView
    private lateinit var previewImage: ImageView
    private lateinit var elapsedText: TextView
    private lateinit var matchInput: EditText
    private lateinit var recordButton: Button
    private lateinit var accountText: TextView
    private lateinit var warningText: TextView
    private lateinit var uploadsText: TextView

    private var lastQrPayload: String? = null

    private val permissionLauncher = registerForActivityResult(
        ActivityResultContracts.RequestMultiplePermissions(),
    ) { result ->
        if (result[Manifest.permission.CAMERA] == false) {
            toast("カメラの権限がないと録画できません")
        }
        EfkCameraService.start(this)
    }

    private val accountLauncher = registerForActivityResult(
        ActivityResultContracts.StartActivityForResult(),
    ) { result ->
        val name = result.data?.getStringExtra(AccountManager.KEY_ACCOUNT_NAME)
        if (!name.isNullOrBlank()) {
            auth.setAccount(name)
            toast("$name を使用します")
        }
    }

    private val consentLauncher = registerForActivityResult(
        ActivityResultContracts.StartActivityForResult(),
    ) { _ ->
        auth.clearRecoveryIntent()
        auth.publish()
    }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContentView(R.layout.activity_main)

        prefs = Prefs.get(this)
        auth = GoogleAuthManager(this)
        tokens = AuthTokens.get(prefs)

        bindViews()
        requestPermissions()
        askIgnoreBatteryOptimization()

        lifecycleScope.launch {
            repeatOnLifecycle(Lifecycle.State.STARTED) {
                launch { AppState.status.collect { render(it) } }
                launch { tickLoop() }
            }
        }
    }

    private fun bindViews() {
        statusText = findViewById(R.id.statusText)
        urlText = findViewById(R.id.urlText)
        pinText = findViewById(R.id.pinText)
        qrImage = findViewById(R.id.qrImage)
        previewImage = findViewById(R.id.previewImage)
        elapsedText = findViewById(R.id.elapsedText)
        matchInput = findViewById(R.id.matchInput)
        recordButton = findViewById(R.id.recordButton)
        accountText = findViewById(R.id.accountText)
        warningText = findViewById(R.id.warningText)
        uploadsText = findViewById(R.id.uploadsText)

        recordButton.setOnClickListener { onRecordButton() }

        findViewById<Button>(R.id.accountButton).setOnClickListener {
            accountLauncher.launch(auth.chooseAccountIntent())
        }
        findViewById<Button>(R.id.newPinButton).setOnClickListener {
            tokens.regeneratePin()
            toast("PIN を作り直しました")
            render(AppState.current)
        }
        findViewById<Button>(R.id.unpairButton).setOnClickListener {
            AlertDialog.Builder(this)
                .setTitle("ペアリングを全部解除しますか？")
                .setMessage("すべての操作端末で、もう一度 PIN の入力が必要になります。")
                .setPositiveButton("解除する") { _, _ ->
                    tokens.revokeAll()
                    toast("ペアリングを解除しました")
                    render(AppState.current)
                }
                .setNegativeButton("やめる", null)
                .show()
        }
        findViewById<Button>(R.id.checklistButton).setOnClickListener { showChecklist() }
    }

    private fun requestPermissions() {
        val needed = mutableListOf(Manifest.permission.CAMERA, Manifest.permission.RECORD_AUDIO)
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            needed += Manifest.permission.POST_NOTIFICATIONS
        }
        val missing = needed.filter {
            ContextCompat.checkSelfPermission(this, it) != android.content.pm.PackageManager.PERMISSION_GRANTED
        }
        if (missing.isEmpty()) {
            EfkCameraService.start(this)
        } else {
            permissionLauncher.launch(missing.toTypedArray())
        }
    }

    @SuppressLint("BatteryLife")
    private fun askIgnoreBatteryOptimization() {
        try {
            val pm = getSystemService(Context.POWER_SERVICE) as PowerManager
            if (pm.isIgnoringBatteryOptimizations(packageName)) return
            AlertDialog.Builder(this)
                .setTitle("電池の最適化を外してください")
                .setMessage(
                    "長時間の録画中に Android がアプリを止めてしまうことがあります。\n" +
                        "次の画面で「許可」を選んでください。",
                )
                .setPositiveButton("設定を開く") { _, _ ->
                    runCatching {
                        startActivity(
                            Intent(
                                Settings.ACTION_REQUEST_IGNORE_BATTERY_OPTIMIZATIONS,
                                Uri.parse("package:$packageName"),
                            ),
                        )
                    }
                }
                .setNegativeButton("あとで", null)
                .show()
        } catch (e: Exception) {
            SafeLog.w(TAG, "電池最適化の確認に失敗しました", e)
        }
    }

    // ------------------------------------------------------------------

    private fun onRecordButton() {
        if (AppState.isRecording) {
            AlertDialog.Builder(this)
                .setTitle("録画を停止しますか？")
                .setMessage("停止すると YouTube へのアップロードが始まります。")
                .setPositiveButton("停止する") { _, _ ->
                    send(EfkCameraService.ACTION_STOP_RECORDING, null)
                }
                .setNegativeButton("続ける", null)
                .show()
        } else {
            send(EfkCameraService.ACTION_START_RECORDING, matchInput.text?.toString().orEmpty())
        }
    }

    private fun send(action: String, matchName: String?) {
        val intent = Intent(this, EfkCameraService::class.java).setAction(action)
        if (matchName != null) intent.putExtra(EfkCameraService.EXTRA_MATCH_NAME, matchName)
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            startForegroundService(intent)
        } else {
            startService(intent)
        }
    }

    // ------------------------------------------------------------------

    private suspend fun tickLoop() {
        // repeatOnLifecycle の外に出たら delay が CancellationException を投げて抜ける
        while (true) {
            updateElapsed()
            updatePreview()
            delay(500L)
        }
    }

    private fun updateElapsed() {
        val rec = AppState.current.recording
        val elapsed = if (rec.state == RecState.RECORDING || rec.state == RecState.STOPPING) {
            SystemClock.elapsedRealtime() - rec.startedAtElapsedRealtime
        } else {
            0L
        }
        elapsedText.text = Fmt.duration(elapsed)
    }

    private fun updatePreview() {
        // 本体画面もブラウザと同じ ImageAnalysis 由来のフレームを見る（設計書 2.4）
        val hub = previewHub() ?: return
        hub.touch()
        val jpeg = hub.latest() ?: return
        runCatching {
            previewImage.setImageBitmap(BitmapFactory.decodeByteArray(jpeg, 0, jpeg.size))
        }
    }

    private fun previewHub() = EfkServiceLocator.previewHub

    private fun render(s: Status) {
        val recording = s.recording.state == RecState.RECORDING

        statusText.text = buildString {
            append(if (s.serverRunning) "● 操作サーバ 稼働中" else "○ 操作サーバ 停止中")
            append("\n")
            append(if (s.camera.ready) "● カメラ 準備完了" else "○ カメラ 未準備")
            append("   ")
            append(if (s.camera.previewAvailable) "プレビュー 可" else "プレビュー 不可")
            append("\n")
            append("BATTERY ${if (s.battery.percent >= 0) "${s.battery.percent}%" else "--"}")
            if (s.battery.charging) append(" (充電中)")
            append("   ")
            append("FREE ${Fmt.bytes(s.storage.freeBytes)}（約${s.storage.recordableMinutes}分）")
            append("\n")
            append("温度 ${"%.1f".format(s.battery.temperatureC)}℃   ")
            append("${s.camera.quality} / ${s.camera.bitrateBps / 1_000_000}Mbps")
        }

        val url = s.serverUrls.firstOrNull()
        urlText.text = if (url != null) {
            "操作端末のブラウザで開く:\n$url"
        } else {
            "Wi-Fi に接続してください"
        }

        pinText.text = "ペアリング PIN: ${tokens.pin}"

        val payload = url?.let { "$it/" }
        if (payload != null && payload != lastQrPayload) {
            lastQrPayload = payload
            QrCode.encode(payload, 400)?.let { qrImage.setImageBitmap(it) }
        }

        recordButton.text = if (recording) "■ 録画停止" else "🔴 録画開始"
        recordButton.isEnabled = s.camera.ready
        matchInput.isEnabled = !recording

        accountText.text = s.google.account?.let { "Google: $it" }
            ?: "Google アカウント 未設定（アップロードできません）"

        warningText.text = s.warnings.joinToString("\n") { w ->
            val mark = when (w.level) {
                "error" -> "■"
                "warn" -> "▲"
                else -> "・"
            }
            "$mark ${w.message}"
        }

        uploadsText.text = buildUploadSummary()
    }

    private fun buildUploadSummary(): String {
        val all = VideoStore.get(this).all()
        if (all.isEmpty()) return "録画履歴はまだありません"
        val holding = all.count { it.holdsFile && it.state != UploadState.DONE }
        val done = all.count { it.state == UploadState.DONE }
        val failed = all.count { it.state == UploadState.FAILED_PERMANENT }
        return buildString {
            append("端末に残っている動画: ${holding}件\n")
            append("アップロード完了: ${done}件\n")
            if (failed > 0) append("失敗（要確認・削除しないでください）: ${failed}件\n")
            all.sortedByDescending { it.startedAtEpochMs }.take(3).forEach { r ->
                append("\n・")
                append(Fmt.buildTitle(r.startedAtEpochMs, r.matchName, r.part, r.totalParts))
                append("  [${r.state}]")
            }
        }
    }

    private fun showChecklist() {
        AlertDialog.Builder(this)
            .setTitle("試合前チェックリスト")
            .setMessage(
                """
                ① 充電ケーブルを挿す（40分録画は電池を大きく消費します）
                ② Wi-Fi またはテザリングに接続する
                ③ 空き容量が「約60分」以上あるか確認する
                ④ Google アカウントが設定されているか確認する
                ⑤ 未アップロードの動画が残っていないか確認する
                ⑥ 電池の最適化を「最適化しない」にする
                ⑦ 画面スリープを長めにする
                ⑧ 日付と時刻が自動設定になっているか確認する
                ⑨ 操作端末から操作画面が開けるか確認する
                ⑩ 10秒だけ試し録りして、映像の向きを確認する
                """.trimIndent(),
            )
            .setPositiveButton("閉じる", null)
            .show()
    }

    private fun toast(message: String) {
        Toast.makeText(this, message, Toast.LENGTH_SHORT).show()
    }

    override fun onResume() {
        super.onResume()
        auth.publish()
        // Google の同意が必要なら、この画面で出す
        auth.pendingRecoveryIntent?.let { intent ->
            auth.clearRecoveryIntent()
            runCatching { consentLauncher.launch(intent) }
        }
        render(AppState.current)
    }

    companion object {
        private const val TAG = "MainActivity"

        fun pendingIntent(context: Context): PendingIntent {
            val intent = Intent(context, MainActivity::class.java)
                .addFlags(Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TOP)
            return PendingIntent.getActivity(
                context,
                0,
                intent,
                PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE,
            )
        }
    }
}
