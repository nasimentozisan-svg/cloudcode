package jp.efk.camera.server

/**
 * PIN の総当たり対策。
 * 時刻を注入できるようにして、CI の Unit Test で検証する。
 */
class PairingLimiter(
    private val maxFailures: Int = MAX_FAILURES,
    private val lockMs: Long = LOCK_MS,
    private val now: () -> Long = { System.currentTimeMillis() },
) {
    private var failures = 0
    private var lockedUntil = 0L

    @Synchronized
    fun isLocked(): Boolean = now() < lockedUntil

    @Synchronized
    fun remainingLockMs(): Long = (lockedUntil - now()).coerceAtLeast(0L)

    /** 失敗を記録する。ロックに入ったら true。 */
    @Synchronized
    fun recordFailure(): Boolean {
        if (isLocked()) return true
        failures++
        if (failures >= maxFailures) {
            lockedUntil = now() + lockMs
            failures = 0
            return true
        }
        return false
    }

    @Synchronized
    fun recordSuccess() {
        failures = 0
        lockedUntil = 0L
    }

    @Synchronized
    fun remainingAttempts(): Int = (maxFailures - failures).coerceAtLeast(0)

    companion object {
        const val MAX_FAILURES = 5
        const val LOCK_MS = 10 * 60 * 1000L
    }
}
