package jp.efk.camera.upload

import android.app.Notification
import android.content.Context
import android.content.pm.ServiceInfo
import android.os.Build
import androidx.core.app.NotificationCompat
import androidx.work.CoroutineWorker
import androidx.work.ForegroundInfo
import androidx.work.WorkerParameters
import jp.efk.camera.EfkApp
import jp.efk.camera.MainActivity
import jp.efk.camera.auth.GoogleAuthManager
import jp.efk.camera.store.DeletionGuard
import jp.efk.camera.store.UploadState
import jp.efk.camera.store.VideoRecord
import jp.efk.camera.store.VideoStore
import jp.efk.camera.util.Fmt
import jp.efk.camera.util.SafeLog
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import java.io.File

/**
 * アップロードとアップロード後の安全な削除。
 *
 * ★ 削除は [DeletionGuard] を通ったときだけ実行する。
 *   しかも「確認結果を保存 → 読み直して再判定 → 削除」の順にする。
 *   保存前にアプリが落ちても、次回は VERIFIED でないので削除されない（設計書 7.1）。
 */
class UploadWorker(
    context: Context,
    params: WorkerParameters,
) : CoroutineWorker(context, params) {

    private val store by lazy { VideoStore.get(applicationContext) }
    private val auth by lazy { GoogleAuthManager(applicationContext) }
    private val uploader by lazy { YouTubeUploader(auth) }

    override suspend fun doWork(): Result = withContext(Dispatchers.IO) {
        runCatching { setForeground(foregroundInfo("アップロードを準備しています", 0)) }
            .onFailure { SafeLog.w(TAG, "フォアグラウンド化できませんでした", it) }

        var needsRetry = false
        var guard = 0

        while (guard++ < MAX_ITEMS_PER_RUN) {
            if (isStopped) return@withContext Result.retry()
            val record = store.pending().firstOrNull() ?: break
            when (processOne(record)) {
                Step.CONTINUE -> Unit
                Step.RETRY_LATER -> {
                    needsRetry = true
                    break
                }
            }
        }

        if (needsRetry) Result.retry() else Result.success()
    }

    private enum class Step { CONTINUE, RETRY_LATER }

    private suspend fun processOne(initial: VideoRecord): Step {
        var record = initial

        // --- ① アップロード（済んでいれば飛ばす） ---
        if (record.state != UploadState.UPLOADED || record.videoId.isNullOrBlank()) {
            val file = File(record.filePath)
            if (!file.exists()) {
                SafeLog.w(TAG, "ファイルが見つかりません id=${record.id}")
                store.update(record.id) {
                    it.copy(
                        state = UploadState.FAILED_PERMANENT,
                        lastError = "録画ファイルが見つかりません",
                    )
                }
                return Step.CONTINUE
            }

            store.update(record.id) {
                it.copy(
                    state = UploadState.UPLOADING,
                    sizeBytes = if (it.sizeBytes > 0) it.sizeBytes else file.length(),
                    attempts = it.attempts + 1,
                    lastError = null,
                )
            }
            record = store.get(record.id) ?: return Step.CONTINUE

            notify(record, record.uploadedBytes)
            var lastPersist = 0L
            val outcome = uploader.run(
                record = record,
                onUploadUrl = { url ->
                    store.update(record.id) {
                        it.copy(
                            uploadUrl = url,
                            uploadUrlCreatedAtEpochMs = System.currentTimeMillis(),
                            uploadedBytes = 0L,
                        )
                    }
                },
                onProgress = { sent ->
                    // 書き込み回数を抑えるため、一定間隔でだけ永続化する
                    val now = System.currentTimeMillis()
                    if (now - lastPersist >= PROGRESS_PERSIST_MS) {
                        lastPersist = now
                        store.update(record.id) { it.copy(uploadedBytes = sent) }
                        notify(record, sent)
                    }
                },
            )

            when (outcome) {
                is YouTubeUploader.Outcome.Success -> {
                    SafeLog.i(TAG, "Video ID を取得しました id=${record.id}")
                    store.update(record.id) {
                        it.copy(
                            state = UploadState.UPLOADED,
                            videoId = outcome.videoId,
                            privacyStatus = outcome.privacyStatus,
                            uploadedBytes = it.sizeBytes,
                            lastError = null,
                        )
                    }
                }

                is YouTubeUploader.Outcome.Retry -> {
                    store.update(record.id) {
                        it.copy(state = UploadState.PENDING_UPLOAD, lastError = outcome.message)
                    }
                    SafeLog.w(TAG, "あとで再試行します: ${outcome.message}")
                    return Step.RETRY_LATER
                }

                is YouTubeUploader.Outcome.NeedsUser -> {
                    store.update(record.id) {
                        it.copy(state = UploadState.PENDING_UPLOAD, lastError = outcome.message)
                    }
                    SafeLog.w(TAG, "人の操作が必要です: ${outcome.message}")
                    return Step.RETRY_LATER
                }

                is YouTubeUploader.Outcome.Permanent -> {
                    // ★ ファイルは絶対に消さない
                    store.update(record.id) {
                        it.copy(state = UploadState.FAILED_PERMANENT, lastError = outcome.message)
                    }
                    SafeLog.e(TAG, "アップロードに失敗しました（要確認）: ${outcome.message}")
                    return Step.CONTINUE
                }
            }
            record = store.get(record.id) ?: return Step.CONTINUE
        }

        // --- ② 存在確認（削除の必須条件） ---
        val videoId = record.videoId
        if (videoId.isNullOrBlank()) {
            store.update(record.id) {
                it.copy(state = UploadState.PENDING_UPLOAD, lastError = "Video ID がありません")
            }
            return Step.RETRY_LATER
        }

        val verification = uploader.verify(videoId)
        if (verification.permanentFailure) {
            store.update(record.id) {
                it.copy(
                    state = UploadState.FAILED_PERMANENT,
                    privacyStatus = verification.privacyStatus ?: it.privacyStatus,
                    lastError = verification.message,
                )
            }
            return Step.CONTINUE
        }
        if (!verification.exists) {
            store.update(record.id) {
                it.copy(state = UploadState.UPLOADED, lastError = verification.message)
            }
            SafeLog.w(TAG, "存在確認が取れませんでした。元動画は保持します")
            return Step.RETRY_LATER
        }

        // ★ 先に「確認できた」ことを保存しきる。削除はそのあと。
        store.update(record.id) {
            it.copy(
                state = UploadState.VERIFIED,
                verifiedAtEpochMs = System.currentTimeMillis(),
                privacyStatus = verification.privacyStatus ?: it.privacyStatus,
                lastError = null,
            )
        }

        // --- ③ 保存済みの状態を読み直してから削除する ---
        val confirmed = store.get(record.id) ?: return Step.CONTINUE
        val reason = DeletionGuard.reasonNotToDelete(confirmed)
        if (reason != null) {
            SafeLog.w(TAG, "削除しません: $reason")
            return Step.CONTINUE
        }

        val file = File(confirmed.filePath)
        val deleted = !file.exists() || file.delete()
        if (deleted) {
            store.update(confirmed.id) {
                it.copy(state = UploadState.DONE, fileDeletedAtEpochMs = System.currentTimeMillis())
            }
            SafeLog.i(TAG, "アップロード確認後に元動画を削除しました id=${confirmed.id}")
            notifyDone(confirmed)
        } else {
            store.update(confirmed.id) { it.copy(lastError = "元動画を削除できませんでした") }
            SafeLog.w(TAG, "元動画を削除できませんでした id=${confirmed.id}")
        }
        return Step.CONTINUE
    }

    // ------------------------------------------------------------------
    // 通知
    // ------------------------------------------------------------------

    private fun notify(record: VideoRecord, sent: Long) {
        val percent = if (record.sizeBytes > 0) {
            ((sent.toDouble() / record.sizeBytes) * 100).toInt().coerceIn(0, 100)
        } else {
            0
        }
        val title = Fmt.buildTitle(
            record.startedAtEpochMs,
            record.matchName,
            record.part,
            record.totalParts,
        )
        runCatching {
            EfkApp.notificationManager(applicationContext)
                .notify(NOTIFICATION_ID, buildNotification("$title を送信中", percent))
        }
    }

    private fun notifyDone(record: VideoRecord) {
        val title = Fmt.buildTitle(
            record.startedAtEpochMs,
            record.matchName,
            record.part,
            record.totalParts,
        )
        runCatching {
            EfkApp.notificationManager(applicationContext).notify(
                NOTIFICATION_ID,
                buildNotification("$title をアップロードし、元動画を削除しました", 100),
            )
        }
    }

    private fun buildNotification(text: String, percent: Int): Notification {
        val intent = MainActivity.pendingIntent(applicationContext)
        return NotificationCompat.Builder(applicationContext, EfkApp.CHANNEL_UPLOAD)
            .setContentTitle("EFK CAMERA")
            .setContentText(text)
            .setSmallIcon(android.R.drawable.stat_sys_upload)
            .setOngoing(true)
            .setOnlyAlertOnce(true)
            .setProgress(100, percent, false)
            .setContentIntent(intent)
            .build()
    }

    private fun foregroundInfo(text: String, percent: Int): ForegroundInfo {
        val notification = buildNotification(text, percent)
        return if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
            ForegroundInfo(
                NOTIFICATION_ID,
                notification,
                ServiceInfo.FOREGROUND_SERVICE_TYPE_DATA_SYNC,
            )
        } else {
            ForegroundInfo(NOTIFICATION_ID, notification)
        }
    }

    companion object {
        private const val TAG = "UploadWorker"
        private const val NOTIFICATION_ID = 1002
        private const val MAX_ITEMS_PER_RUN = 20
        private const val PROGRESS_PERSIST_MS = 3_000L
    }
}
