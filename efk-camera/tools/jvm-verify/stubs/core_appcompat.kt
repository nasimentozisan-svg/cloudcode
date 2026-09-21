package androidx.core.app
import android.app.Notification
import android.app.PendingIntent
import android.app.Service
import android.content.Context
object NotificationCompat {
    class Builder(context: Context, channelId: String) {
        fun setContentTitle(t: CharSequence): Builder = this
        fun setContentText(t: CharSequence): Builder = this
        fun setSmallIcon(icon: Int): Builder = this
        fun setOngoing(b: Boolean): Builder = this
        fun setOnlyAlertOnce(b: Boolean): Builder = this
        fun setProgress(max: Int, progress: Int, indeterminate: Boolean): Builder = this
        fun setContentIntent(p: PendingIntent): Builder = this
        fun build(): Notification = throw UnsupportedOperationException()
    }
}
object ServiceCompat {
    @JvmStatic fun startForeground(service: Service, id: Int, notification: Notification, type: Int) {}
}
