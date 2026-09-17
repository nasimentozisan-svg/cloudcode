package jp.efk.camera

import jp.efk.camera.core.ThermalGuard
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Before
import org.junit.Test

class ThermalGuardTest {

    @Before
    fun setUp() {
        ThermalGuard.reset()
    }

    @Test
    fun `40度を超えるとプレビューを止める`() {
        ThermalGuard.onTemperature(35.0f)
        assertFalse(ThermalGuard.previewBlocked)
        ThermalGuard.onTemperature(40.1f)
        assertTrue(ThermalGuard.previewBlocked)
    }

    @Test
    fun `境界でばたつかない`() {
        ThermalGuard.onTemperature(41.0f)
        assertTrue(ThermalGuard.previewBlocked)
        // 39度まで下がってもすぐには戻さない
        ThermalGuard.onTemperature(39.0f)
        assertTrue(ThermalGuard.previewBlocked)
        // 38度以下で復帰
        ThermalGuard.onTemperature(37.5f)
        assertFalse(ThermalGuard.previewBlocked)
    }

    @Test
    fun `温度が取れない場合は状態を変えない`() {
        ThermalGuard.onTemperature(42.0f)
        assertTrue(ThermalGuard.previewBlocked)
        ThermalGuard.onTemperature(0.0f)
        assertTrue(ThermalGuard.previewBlocked)
    }
}
