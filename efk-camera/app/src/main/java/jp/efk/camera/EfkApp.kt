package jp.efk.camera

import android.app.Application
import android.app.NotificationChannel
import android.app.NotificationManager
import android.content.Context
import jp.efk.camera.upload.UploadScheduler
import jp.efk.camera.util.SafeLog

class EfkApp : Application() {

    override fun onCreate() {
        super.onCreate()
        createChannels()
        // 前回終了時に残っていたアップロード待ちを拾う（設計書 4.2）
        UploadScheduler.enqueue(this, "アプリ起動")
        SafeLog.i(TAG, "EFK CAMERA ${BuildConfig.VERSION_NAME} (${BuildConfig.GIT_SHA})")
    }

    private fun createChannels() {
        val manager = notificationManager(this)
        manager.createNotificationChannel(
            NotificationChannel(
                CHANNEL_SERVICE,
                "撮影中",
                NotificationManager.IMPORTANCE_LOW,
            ).apply {
                description = "カメラと操作サーバの稼働状態"
                setShowBadge(false)
            },
        )
        manager.createNotificationChannel(
            NotificationChannel(
                CHANNEL_UPLOAD,
                "アップロード",
                NotificationManager.IMPORTANCE_LOW,
            ).apply {
                description = "YouTube へのアップロード状況"
                setShowBadge(false)
            },
        )
    }

    companion object {
        private const val TAG = "App"
        const val CHANNEL_SERVICE = "efk_service"
        const val CHANNEL_UPLOAD = "efk_upload"

        fun notificationManager(context: Context): NotificationManager =
            context.getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
    }
}
