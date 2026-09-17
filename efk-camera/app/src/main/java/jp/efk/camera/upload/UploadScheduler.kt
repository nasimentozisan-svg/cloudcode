package jp.efk.camera.upload

import android.content.Context
import androidx.work.BackoffPolicy
import androidx.work.Constraints
import androidx.work.ExistingWorkPolicy
import androidx.work.NetworkType
import androidx.work.OneTimeWorkRequestBuilder
import androidx.work.WorkManager
import jp.efk.camera.core.Prefs
import jp.efk.camera.store.VideoStore
import jp.efk.camera.util.SafeLog
import java.util.concurrent.TimeUnit

/**
 * アップロードのエンキュー。
 *
 * WorkManager に任せることで、アプリが落ちても端末が再起動しても
 * OS がジョブを復活させてくれる（設計書 4.2）。
 */
object UploadScheduler {

    const val WORK_NAME = "efk_upload_queue"

    /** アップロード待ちがあれば実行を予約する。 */
    fun enqueue(context: Context, reason: String) {
        val pending = VideoStore.get(context).pending()
        if (pending.isEmpty()) {
            SafeLog.d(TAG, "アップロード待ちはありません ($reason)")
            return
        }
        val prefs = Prefs.get(context)
        val constraints = Constraints.Builder()
            .setRequiredNetworkType(
                if (prefs.wifiOnlyUpload) NetworkType.UNMETERED else NetworkType.CONNECTED,
            )
            .setRequiresStorageNotLow(false)
            .build()

        val request = OneTimeWorkRequestBuilder<UploadWorker>()
            .setConstraints(constraints)
            .setBackoffCriteria(BackoffPolicy.EXPONENTIAL, 30, TimeUnit.SECONDS)
            .addTag(WORK_NAME)
            .build()

        WorkManager.getInstance(context)
            .enqueueUniqueWork(WORK_NAME, ExistingWorkPolicy.APPEND_OR_REPLACE, request)

        SafeLog.i(TAG, "アップロードを予約しました (${pending.size}件 / $reason)")
    }

    /** 設定変更などで制約をかけ直したいとき。 */
    fun reschedule(context: Context) {
        WorkManager.getInstance(context).cancelUniqueWork(WORK_NAME)
        enqueue(context, "設定変更")
    }

    private const val TAG = "UploadSched"
}
