package jp.efk.camera.util

import android.util.Log

/**
 * アプリ内のログ出力口はここだけにする。
 * android.util.Log を直接呼ばないこと（CI で増加を検査している）。
 */
object SafeLog {
    private const val TAG = "EFK"

    fun d(tag: String, message: String) {
        Log.d(TAG, "[$tag] " + Redactor.redact(message))
    }

    fun i(tag: String, message: String) {
        Log.i(TAG, "[$tag] " + Redactor.redact(message))
    }

    fun w(tag: String, message: String, t: Throwable? = null) {
        val text = "[$tag] " + Redactor.redact(message)
        if (t == null) Log.w(TAG, text) else Log.w(TAG, text, t)
    }

    fun e(tag: String, message: String, t: Throwable? = null) {
        val text = "[$tag] " + Redactor.redact(message)
        if (t == null) Log.e(TAG, text) else Log.e(TAG, text, t)
    }

    /** 例外メッセージをユーザー向けに整形する（秘密情報を含めない）。 */
    fun describe(t: Throwable): String {
        val name = t.javaClass.simpleName
        val msg = Redactor.redact(t.message)
        return if (msg.isBlank()) name else "$name: $msg"
    }
}
