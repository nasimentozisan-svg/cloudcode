package jp.efk.camera.camera

import android.os.SystemClock
import java.util.concurrent.TimeUnit
import java.util.concurrent.locks.ReentrantLock

/**
 * 最新のプレビューフレーム（JPEG）を配給する。
 *
 * 本体画面の ImageView も、ブラウザ向けの MJPEG も、すべてここから取る。
 * 見ている人が誰もいない間は [hasConsumer] が false になり、
 * CameraController 側で JPEG 変換そのものを止める（発熱・CPU対策）。
 */
class PreviewHub {

    private val lock = ReentrantLock()
    private val newFrame = lock.newCondition()

    private var frame: ByteArray? = null
    private var seq: Long = 0L

    @Volatile
    private var lastConsumerAt: Long = 0L

    @Volatile
    var width: Int = 0
        private set

    @Volatile
    var height: Int = 0
        private set

    /** プレビューを見ている人がいることを知らせる。 */
    fun touch() {
        lastConsumerAt = SystemClock.elapsedRealtime()
    }

    fun hasConsumer(): Boolean =
        SystemClock.elapsedRealtime() - lastConsumerAt < CONSUMER_TTL_MS

    fun publish(jpeg: ByteArray, w: Int, h: Int) {
        lock.lock()
        try {
            frame = jpeg
            width = w
            height = h
            seq++
            newFrame.signalAll()
        } finally {
            lock.unlock()
        }
    }

    fun clear() {
        lock.lock()
        try {
            frame = null
            seq++
            newFrame.signalAll()
        } finally {
            lock.unlock()
        }
    }

    fun latest(): ByteArray? {
        lock.lock()
        try {
            return frame
        } finally {
            lock.unlock()
        }
    }

    /**
     * [afterSeq] より新しいフレームを待つ。
     * タイムアウトしたら null（MJPEG ストリームはそこで終端する）。
     */
    fun awaitFrame(afterSeq: Long, timeoutMs: Long): Frame? {
        val deadline = SystemClock.elapsedRealtime() + timeoutMs
        lock.lock()
        try {
            while (seq <= afterSeq || frame == null) {
                val remain = deadline - SystemClock.elapsedRealtime()
                if (remain <= 0L) return null
                try {
                    newFrame.await(remain, TimeUnit.MILLISECONDS)
                } catch (e: InterruptedException) {
                    Thread.currentThread().interrupt()
                    return null
                }
            }
            return Frame(seq, frame!!)
        } finally {
            lock.unlock()
        }
    }

    class Frame(val seq: Long, val jpeg: ByteArray)

    companion object {
        /** 最後のアクセスからこの時間だけはフレーム生成を続ける。 */
        const val CONSUMER_TTL_MS = 8_000L
    }
}
