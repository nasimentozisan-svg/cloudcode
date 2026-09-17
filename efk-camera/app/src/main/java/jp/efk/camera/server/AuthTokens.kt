package jp.efk.camera.server

import jp.efk.camera.core.Prefs
import java.security.MessageDigest
import java.security.SecureRandom
import java.util.Locale

/**
 * ペアリング用 PIN と、操作端末ごとのトークンを管理する。
 *
 * - PIN はアプリ起動ごとに生成し、KYV47 の画面にだけ表示する
 * - 操作端末は初回だけ PIN を入力し、以後はトークンで認証する
 * - トークンは端末内で生成した乱数。Git にもサーバにも存在しない
 */
class AuthTokens private constructor(private val prefs: Prefs) {

    private val random = SecureRandom()
    private val limiter = PairingLimiter()

    @Volatile
    var pin: String = generatePin()
        private set

    fun regeneratePin() {
        pin = generatePin()
    }

    private fun generatePin(): String =
        String.format(Locale.US, "%06d", random.nextInt(1_000_000))

    fun isLocked(): Boolean = limiter.isLocked()

    fun remainingLockMs(): Long = limiter.remainingLockMs()

    fun remainingAttempts(): Int = limiter.remainingAttempts()

    /**
     * PIN を検証し、成功したら新しいトークンを返す。
     * 失敗したら null（ロック中も null）。
     */
    fun pair(candidate: String?): String? {
        if (limiter.isLocked()) return null
        val ok = candidate != null && constantTimeEquals(candidate.trim(), pin)
        if (!ok) {
            if (limiter.recordFailure()) {
                // ロックに入ったタイミングで PIN を作り直す
                regeneratePin()
            }
            return null
        }
        limiter.recordSuccess()
        val token = newToken()
        prefs.pairedTokens = prefs.pairedTokens + token
        return token
    }

    fun isValid(token: String?): Boolean {
        if (token.isNullOrBlank()) return false
        return prefs.pairedTokens.any { constantTimeEquals(it, token) }
    }

    fun revokeAll() {
        prefs.pairedTokens = emptySet()
        regeneratePin()
    }

    fun pairedCount(): Int = prefs.pairedTokens.size

    private fun newToken(): String {
        val bytes = ByteArray(24)
        random.nextBytes(bytes)
        return "efk_" + bytes.joinToString("") { "%02x".format(it) }
    }

    /** 比較時間から情報が漏れないようにする。 */
    private fun constantTimeEquals(a: String, b: String): Boolean {
        val ab = a.toByteArray()
        val bb = b.toByteArray()
        val ah = MessageDigest.getInstance("SHA-256").digest(ab)
        val bh = MessageDigest.getInstance("SHA-256").digest(bb)
        return MessageDigest.isEqual(ah, bh)
    }

    companion object {
        @Volatile
        private var instance: AuthTokens? = null

        /** 本体画面とサーバが同じ PIN / トークンを見るように、1個だけ持つ。 */
        fun get(prefs: Prefs): AuthTokens =
            instance ?: synchronized(this) {
                instance ?: AuthTokens(prefs).also { instance = it }
            }
    }
}
