package jp.efk.camera.camera

import android.Manifest
import android.annotation.SuppressLint
import android.content.Context
import android.content.pm.PackageManager
import android.graphics.Bitmap
import android.graphics.Matrix
import android.os.Environment
import android.os.SystemClock
import android.util.Size
import android.view.Surface
import androidx.camera.core.CameraSelector
import androidx.camera.core.ImageAnalysis
import androidx.camera.core.ImageProxy
import androidx.camera.core.resolutionselector.ResolutionSelector
import androidx.camera.core.resolutionselector.ResolutionStrategy
import androidx.camera.lifecycle.ProcessCameraProvider
import androidx.camera.video.FallbackStrategy
import androidx.camera.video.FileOutputOptions
import androidx.camera.video.Quality
import androidx.camera.video.QualitySelector
import androidx.camera.video.Recorder
import androidx.camera.video.Recording
import androidx.camera.video.VideoCapture
import androidx.camera.video.VideoRecordEvent
import androidx.core.content.ContextCompat
import androidx.lifecycle.LifecycleOwner
import jp.efk.camera.core.AppState
import jp.efk.camera.core.CameraInfo
import jp.efk.camera.core.Prefs
import jp.efk.camera.core.RecState
import jp.efk.camera.core.RecordingInfo
import jp.efk.camera.core.ThermalGuard
import jp.efk.camera.store.UploadState
import jp.efk.camera.store.VideoRecord
import jp.efk.camera.store.VideoStore
import jp.efk.camera.util.Fmt
import jp.efk.camera.util.SafeLog
import jp.efk.camera.util.StoragePlanner
import java.io.ByteArrayOutputStream
import java.io.File
import java.util.concurrent.ExecutorService
import java.util.concurrent.Executors
import java.util.concurrent.atomic.AtomicBoolean

/**
 * CameraX のバインドと録画セッションの管理。
 *
 * 設計上の要点（設計書 2.3 / 2.4）
 *  - Preview ユースケースは **バインドしない**。画面の開閉でカメラセッションが
 *    再構成され、録画が中断されるのを原理的に防ぐため。
 *    本体画面もブラウザも ImageAnalysis 由来の同じ JPEG を見る。
 *  - ファイルサイズ上限に達しても録画を止めず、次のパートへ自動継続する。
 *  - アップロードは「セッション全体が終わってから」まとめて登録する
 *    （録画中にアップロードを走らせない。総パート数も確定する）。
 */
class CameraController(
    private val context: Context,
    private val lifecycleOwner: LifecycleOwner,
    private val onSessionFinished: (sessionId: String, recordIds: List<String>) -> Unit,
) {

    private val prefs = Prefs.get(context)
    private val store = VideoStore.get(context)

    val previewHub = PreviewHub()

    private val analysisExecutor: ExecutorService = Executors.newSingleThreadExecutor()
    private val mainExecutor = ContextCompat.getMainExecutor(context)

    private var cameraProvider: ProcessCameraProvider? = null
    private var videoCapture: VideoCapture<Recorder>? = null
    private var imageAnalysis: ImageAnalysis? = null

    private var recording: Recording? = null
    private var session: Session? = null
    private val stopRequested = AtomicBoolean(false)

    private var lastFrameAt = 0L

    // ------------------------------------------------------------------
    // 起動
    // ------------------------------------------------------------------

    /** カメラをバインドする。プレビューのバインドに失敗したら録画専用に降格する。 */
    fun start() {
        val future = ProcessCameraProvider.getInstance(context)
        future.addListener({
            try {
                val provider = future.get()
                cameraProvider = provider
                bind(provider)
            } catch (e: Exception) {
                SafeLog.e(TAG, "カメラの初期化に失敗しました", e)
                AppState.update {
                    it.copy(camera = it.camera.copy(ready = false, error = SafeLog.describe(e)))
                }
            }
        }, mainExecutor)
    }

    private fun bind(provider: ProcessCameraProvider) {
        val recorder = buildRecorder()
        val capture = VideoCapture.withOutput(recorder)
        videoCapture = capture
        capture.targetRotation = targetRotation()

        val selector = CameraSelector.DEFAULT_BACK_CAMERA
        provider.unbindAll()

        // 第1候補：録画 + プレビュー
        val analysis = buildImageAnalysis()
        val previewOk = try {
            provider.bindToLifecycle(lifecycleOwner, selector, capture, analysis)
            analysis.setAnalyzer(analysisExecutor) { proxy -> onFrame(proxy) }
            imageAnalysis = analysis
            true
        } catch (e: Exception) {
            SafeLog.w(TAG, "プレビュー付きのバインドに失敗したため、録画専用に切り替えます", e)
            imageAnalysis = null
            false
        }

        // 第2候補：録画のみ
        if (!previewOk) {
            try {
                provider.unbindAll()
                provider.bindToLifecycle(lifecycleOwner, selector, capture)
            } catch (e: Exception) {
                SafeLog.e(TAG, "カメラのバインドに失敗しました", e)
                AppState.update {
                    it.copy(camera = CameraInfo(ready = false, error = SafeLog.describe(e)))
                }
                return
            }
        }

        AppState.update {
            it.copy(
                camera = CameraInfo(
                    ready = true,
                    previewAvailable = previewOk,
                    quality = prefs.quality,
                    bitrateBps = prefs.videoBitrate,
                    error = null,
                ),
            )
        }
        SafeLog.i(TAG, "カメラを開始しました (プレビュー: $previewOk)")
    }

    private fun buildRecorder(): Recorder {
        val quality = if (prefs.quality == Prefs.Q_HD) Quality.HD else Quality.FHD
        val selector = QualitySelector.from(
            quality,
            FallbackStrategy.lowerQualityOrHigherThan(Quality.HD),
        )
        return Recorder.Builder()
            .setQualitySelector(selector)
            // ★ 端末既定（1080pで17〜20Mbps）のままだと40分で4GBの壁に当たる。
            //    明示的に落とすことが長時間録画の安定性に直結する（設計書 2.2）。
            .setTargetVideoEncodingBitRate(prefs.videoBitrate)
            .build()
    }

    private fun buildImageAnalysis(): ImageAnalysis {
        val resolution = ResolutionSelector.Builder()
            .setResolutionStrategy(
                ResolutionStrategy(
                    Size(PREVIEW_WIDTH, PREVIEW_HEIGHT),
                    ResolutionStrategy.FALLBACK_RULE_CLOSEST_LOWER_THEN_HIGHER,
                ),
            )
            .build()
        return ImageAnalysis.Builder()
            .setResolutionSelector(resolution)
            .setBackpressureStrategy(ImageAnalysis.STRATEGY_KEEP_ONLY_LATEST)
            .build()
            .also { it.targetRotation = targetRotation() }
    }

    /** 設定に応じた録画の向き。録画開始前にだけ適用する。 */
    private fun targetRotation(): Int = when (prefs.orientation) {
        Prefs.O_LAND_B -> Surface.ROTATION_270
        Prefs.O_PORTRAIT -> Surface.ROTATION_0
        else -> Surface.ROTATION_90
    }

    fun shutdown() {
        try {
            recording?.stop()
        } catch (e: Exception) {
            SafeLog.w(TAG, "録画の停止に失敗しました", e)
        }
        recording = null
        try {
            imageAnalysis?.clearAnalyzer()
            cameraProvider?.unbindAll()
        } catch (e: Exception) {
            SafeLog.w(TAG, "カメラの解放に失敗しました", e)
        }
        analysisExecutor.shutdown()
        previewHub.clear()
    }

    /** 設定変更後にカメラを組み直す（録画中は無視する）。 */
    fun rebind() {
        if (AppState.isRecording) return
        val provider = cameraProvider ?: return
        try {
            imageAnalysis?.clearAnalyzer()
            provider.unbindAll()
            bind(provider)
        } catch (e: Exception) {
            SafeLog.e(TAG, "カメラの再設定に失敗しました", e)
        }
    }

    // ------------------------------------------------------------------
    // プレビュー
    // ------------------------------------------------------------------

    private fun onFrame(proxy: ImageProxy) {
        try {
            val now = SystemClock.elapsedRealtime()
            val wanted = prefs.previewEnabled && !ThermalGuard.previewBlocked &&
                previewHub.hasConsumer()
            if (!wanted || now - lastFrameAt < PREVIEW_INTERVAL_MS) return
            lastFrameAt = now

            val bitmap = proxy.toBitmap()
            val rotated = rotate(bitmap, proxy.imageInfo.rotationDegrees)
            val out = ByteArrayOutputStream(48 * 1024)
            rotated.compress(Bitmap.CompressFormat.JPEG, PREVIEW_JPEG_QUALITY, out)
            previewHub.publish(out.toByteArray(), rotated.width, rotated.height)
            if (rotated !== bitmap) rotated.recycle()
            bitmap.recycle()
        } catch (e: Exception) {
            SafeLog.w(TAG, "プレビューフレームの生成に失敗しました", e)
        } finally {
            proxy.close()
        }
    }

    private fun rotate(src: Bitmap, degrees: Int): Bitmap {
        if (degrees % 360 == 0) return src
        val m = Matrix().apply { postRotate(degrees.toFloat()) }
        return Bitmap.createBitmap(src, 0, 0, src.width, src.height, m, true)
    }

    // ------------------------------------------------------------------
    // 録画
    // ------------------------------------------------------------------

    /** 録画開始。失敗した理由を文字列で返す（成功なら null）。 */
    @SuppressLint("MissingPermission")
    fun startRecording(matchName: String): String? {
        if (AppState.isRecording) return "すでに録画中です"
        val capture = videoCapture ?: return "カメラの準備ができていません"

        if (ContextCompat.checkSelfPermission(context, Manifest.permission.CAMERA)
            != PackageManager.PERMISSION_GRANTED
        ) {
            return "カメラの権限が許可されていません"
        }

        val dir = recordingDir()
        val free = dir.usableSpace
        val required = StoragePlanner.requiredFreeBytes(prefs.videoBitrate, prefs.audioEnabled)
        if (free < required) {
            return "空き容量が足りません（空き ${Fmt.bytes(free)} / 必要 ${Fmt.bytes(required)}）。" +
                "アップロード待ちの動画がないか確認してください"
        }

        val now = System.currentTimeMillis()
        val id = Fmt.fileStamp(now)
        session = Session(
            id = id,
            matchName = matchName.trim(),
            startedAtEpochMs = now,
            startedAtElapsedRealtime = SystemClock.elapsedRealtime(),
        )
        stopRequested.set(false)
        prefs.activeSessionId = id

        // 録画中に向きが変わっても途中で切り替わらないよう、開始前に確定させる。
        capture.targetRotation = targetRotation()

        AppState.update {
            it.copy(
                recording = RecordingInfo(
                    state = RecState.STARTING,
                    sessionId = id,
                    matchName = matchName.trim(),
                    startedAtEpochMs = now,
                    startedAtElapsedRealtime = SystemClock.elapsedRealtime(),
                    part = 1,
                ),
            )
        }
        val failure = startPart(1)
        if (failure != null) {
            // 1本目が始まらなかったらセッションを残さない
            session = null
            prefs.activeSessionId = null
            AppState.update {
                it.copy(recording = RecordingInfo(state = RecState.ERROR, error = failure))
            }
        }
        return failure
    }

    @SuppressLint("MissingPermission")
    private fun startPart(part: Int): String? {
        val capture = videoCapture ?: return "カメラの準備ができていません"
        val s = session ?: return "録画セッションがありません"

        val file = File(recordingDir(), "${s.id}-p$part.mp4")
        val builder = FileOutputOptions.Builder(file)
            .setFileSizeLimit(StoragePlanner.MAX_PART_BYTES)
        val split = prefs.splitMinutes
        if (split > 0) {
            builder.setDurationLimitMillis(split * 60_000L)
        }

        return try {
            var pending = capture.output.prepareRecording(context, builder.build())
            val audioGranted = ContextCompat.checkSelfPermission(
                context,
                Manifest.permission.RECORD_AUDIO,
            ) == PackageManager.PERMISSION_GRANTED
            if (prefs.audioEnabled && audioGranted) {
                pending = pending.withAudioEnabled()
            }
            recording = pending.start(mainExecutor) { event -> onRecordEvent(event, file, part) }
            null
        } catch (e: Exception) {
            SafeLog.e(TAG, "録画の開始に失敗しました", e)
            AppState.update {
                it.copy(
                    recording = it.recording.copy(
                        state = RecState.ERROR,
                        error = SafeLog.describe(e),
                    ),
                )
            }
            SafeLog.describe(e)
        }
    }

    /** 録画停止。 */
    fun stopRecording(): String? {
        val rec = recording ?: return "録画していません"
        stopRequested.set(true)
        AppState.update { it.copy(recording = it.recording.copy(state = RecState.STOPPING)) }
        return try {
            rec.stop()
            null
        } catch (e: Exception) {
            SafeLog.e(TAG, "録画の停止に失敗しました", e)
            SafeLog.describe(e)
        }
    }

    private fun onRecordEvent(event: VideoRecordEvent, file: File, part: Int) {
        when (event) {
            is VideoRecordEvent.Start -> {
                AppState.update {
                    it.copy(recording = it.recording.copy(state = RecState.RECORDING, part = part))
                }
                SafeLog.i(TAG, "録画を開始しました part=$part")
            }

            is VideoRecordEvent.Status -> {
                val bytes = event.recordingStats.numBytesRecorded
                AppState.update { it.copy(recording = it.recording.copy(bytesRecorded = bytes)) }
            }

            is VideoRecordEvent.Finalize -> onFinalize(event, file, part)

            else -> Unit
        }
    }

    private fun onFinalize(event: VideoRecordEvent.Finalize, file: File, part: Int) {
        val s = session
        val error = event.error
        val fileUsable = file.exists() && file.length() > MIN_USABLE_BYTES &&
            error != VideoRecordEvent.Finalize.ERROR_NO_VALID_DATA &&
            error != VideoRecordEvent.Finalize.ERROR_INVALID_OUTPUT_OPTIONS

        if (event.hasError()) {
            SafeLog.w(TAG, "録画が異常終了しました error=$error usable=$fileUsable")
        }

        if (s == null) {
            SafeLog.w(TAG, "セッション情報が無い状態で Finalize を受け取りました")
            return
        }

        if (fileUsable) {
            val record = VideoRecord(
                id = "${s.id}-p$part",
                sessionId = s.id,
                filePath = file.absolutePath,
                matchName = s.matchName,
                startedAtEpochMs = s.startedAtEpochMs,
                durationMs = event.recordingStats.recordedDurationNanos / 1_000_000L,
                sizeBytes = file.length(),
                part = part,
                totalParts = part,
                state = UploadState.PENDING_UPLOAD,
            )
            store.put(record)
            s.recordIds.add(record.id)
        } else {
            SafeLog.w(TAG, "使用できないファイルを削除します part=$part")
            runCatching { if (file.exists()) file.delete() }
        }

        // 上限到達で終わった場合は、止められたのではなく「区切られた」だけ。
        // 停止指示が出ていなければ次のパートへ継続する。
        val autoContinue = !stopRequested.get() && (
            error == VideoRecordEvent.Finalize.ERROR_FILE_SIZE_LIMIT_REACHED ||
                error == VideoRecordEvent.Finalize.ERROR_DURATION_LIMIT_REACHED
            )

        if (autoContinue) {
            SafeLog.i(TAG, "次のパートへ自動継続します part=${part + 1}")
            AppState.update { it.copy(recording = it.recording.copy(part = part + 1)) }
            val failure = startPart(part + 1)
            if (failure == null) return
            SafeLog.e(TAG, "自動継続に失敗しました: $failure")
        }

        finishSession(s, if (event.hasError() && !fileUsable) "録画エラー (code=$error)" else null)
    }

    private fun finishSession(s: Session, error: String?) {
        recording = null
        session = null
        stopRequested.set(false)
        prefs.activeSessionId = null

        // 総パート数が確定したので、全レコードに反映してからアップロードへ回す。
        val total = s.recordIds.size
        s.recordIds.forEach { id ->
            store.update(id) { it.copy(totalParts = total) }
        }

        AppState.update {
            it.copy(
                recording = RecordingInfo(
                    state = if (error != null) RecState.ERROR else RecState.IDLE,
                    error = error,
                ),
            )
        }

        SafeLog.i(TAG, "録画セッションを終了しました parts=$total")
        onSessionFinished(s.id, s.recordIds.toList())
    }

    // ------------------------------------------------------------------

    fun recordingDir(): File {
        val dir = context.getExternalFilesDir(Environment.DIRECTORY_MOVIES)
            ?: File(context.filesDir, "movies")
        if (!dir.exists()) dir.mkdirs()
        return dir
    }

    private class Session(
        val id: String,
        val matchName: String,
        val startedAtEpochMs: Long,
        val startedAtElapsedRealtime: Long,
        val recordIds: MutableList<String> = mutableListOf(),
    )

    companion object {
        private const val TAG = "Camera"

        /** これ未満のファイルは中身が無いとみなす。 */
        private const val MIN_USABLE_BYTES = 200_000L

        private const val PREVIEW_WIDTH = 640
        private const val PREVIEW_HEIGHT = 360
        private const val PREVIEW_INTERVAL_MS = 250L
        private const val PREVIEW_JPEG_QUALITY = 55
    }
}
