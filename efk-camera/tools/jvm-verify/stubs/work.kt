package androidx.work
import android.content.Context
import android.app.Notification
import java.util.concurrent.TimeUnit

abstract class ListenableWorker(val applicationContext: Context, params: WorkerParameters) {
    val isStopped: Boolean = false
    abstract class Result {
        companion object {
            @JvmStatic fun success(): Result = throw UnsupportedOperationException()
            @JvmStatic fun retry(): Result = throw UnsupportedOperationException()
            @JvmStatic fun failure(): Result = throw UnsupportedOperationException()
        }
    }
}
class WorkerParameters
abstract class CoroutineWorker(appContext: Context, params: WorkerParameters) :
    ListenableWorker(appContext, params) {
    abstract suspend fun doWork(): Result
    suspend fun setForeground(foregroundInfo: ForegroundInfo) {}
}
class ForegroundInfo {
    constructor(notificationId: Int, notification: Notification)
    constructor(notificationId: Int, notification: Notification, foregroundServiceType: Int)
}
enum class NetworkType { NOT_REQUIRED, CONNECTED, UNMETERED, NOT_ROAMING, METERED }
enum class BackoffPolicy { EXPONENTIAL, LINEAR }
enum class ExistingWorkPolicy { REPLACE, KEEP, APPEND, APPEND_OR_REPLACE }
class Constraints private constructor() {
    class Builder {
        fun setRequiredNetworkType(t: NetworkType): Builder = this
        fun setRequiresStorageNotLow(b: Boolean): Builder = this
        fun build(): Constraints = throw UnsupportedOperationException()
    }
}
abstract class WorkRequest { abstract class Builder<B, W> }
class OneTimeWorkRequest private constructor() : WorkRequest() {
    class Builder(workerClass: Class<out ListenableWorker>) {
        fun setConstraints(c: Constraints): Builder = this
        fun setBackoffCriteria(p: BackoffPolicy, d: Long, u: TimeUnit): Builder = this
        fun addTag(tag: String): Builder = this
        fun build(): OneTimeWorkRequest = throw UnsupportedOperationException()
    }
}
inline fun <reified W : ListenableWorker> OneTimeWorkRequestBuilder(): OneTimeWorkRequest.Builder =
    OneTimeWorkRequest.Builder(W::class.java)
abstract class WorkManager {
    abstract fun enqueueUniqueWork(name: String, policy: ExistingWorkPolicy, request: OneTimeWorkRequest): Any
    abstract fun cancelUniqueWork(name: String): Any
    companion object { @JvmStatic fun getInstance(context: Context): WorkManager = throw UnsupportedOperationException() }
}
