package jp.efk.camera

import jp.efk.camera.server.PairingLimiter
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test

class PairingLimiterTest {

    private var clock = 0L

    private fun limiter() = PairingLimiter(maxFailures = 5, lockMs = 600_000L) { clock }

    @Test
    fun `5回失敗するとロックされる`() {
        val l = limiter()
        repeat(4) { assertFalse(l.recordFailure()) }
        assertTrue(l.recordFailure())
        assertTrue(l.isLocked())
    }

    @Test
    fun `ロックは時間が経てば解ける`() {
        val l = limiter()
        repeat(5) { l.recordFailure() }
        assertTrue(l.isLocked())
        clock += 599_000L
        assertTrue(l.isLocked())
        clock += 2_000L
        assertFalse(l.isLocked())
    }

    @Test
    fun `成功したら失敗カウントは戻る`() {
        val l = limiter()
        repeat(4) { l.recordFailure() }
        l.recordSuccess()
        assertEquals(5, l.remainingAttempts())
        assertFalse(l.recordFailure())
        assertFalse(l.isLocked())
    }

    @Test
    fun `残り試行回数が正しい`() {
        val l = limiter()
        assertEquals(5, l.remainingAttempts())
        l.recordFailure()
        assertEquals(4, l.remainingAttempts())
        l.recordFailure()
        assertEquals(3, l.remainingAttempts())
    }

    @Test
    fun `ロック中は失敗してもカウントを増やさない`() {
        val l = limiter()
        repeat(5) { l.recordFailure() }
        assertTrue(l.recordFailure())
        assertTrue(l.recordFailure())
        clock += 600_001L
        assertFalse(l.isLocked())
    }
}
