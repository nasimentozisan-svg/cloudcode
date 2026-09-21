package jp.efk.camera

import jp.efk.camera.util.StoragePlanner
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test

class StoragePlannerTest {

    private val gb = 1024L * 1024 * 1024

    @Test
    fun `1080p8Mbpsの40分は概ね2_5GB以内に収まる`() {
        val bytes = StoragePlanner.bytesForMinutes(StoragePlanner.DEFAULT_BITRATE_FHD, true, 40)
        assertTrue("実際=$bytes", bytes in (2.0 * gb).toLong()..(2.7 * gb).toLong())
    }

    @Test
    fun `1080p8Mbpsなら60分でも1ファイルに収まる`() {
        val bytes = StoragePlanner.bytesForMinutes(StoragePlanner.DEFAULT_BITRATE_FHD, true, 60)
        assertTrue("実際=$bytes", bytes < StoragePlanner.MAX_PART_BYTES)
    }

    @Test
    fun `ファイル上限は4GiBの手前に置く`() {
        assertTrue(StoragePlanner.MAX_PART_BYTES < 4L * 1024 * 1024 * 1024)
    }

    @Test
    fun `70分を超えると分割される想定`() {
        // 上限に当たっても録画は止めず次のパートへ継続する（CameraController）
        val bytes = StoragePlanner.bytesForMinutes(StoragePlanner.DEFAULT_BITRATE_FHD, true, 70)
        assertTrue(bytes > StoragePlanner.MAX_PART_BYTES)
    }

    @Test
    fun `720p5Mbpsはさらに小さい`() {
        val fhd = StoragePlanner.bytesForMinutes(StoragePlanner.DEFAULT_BITRATE_FHD, true, 40)
        val hd = StoragePlanner.bytesForMinutes(StoragePlanner.DEFAULT_BITRATE_HD, true, 40)
        assertTrue(hd < fhd)
    }

    @Test
    fun `音声を切ると必要容量が減る`() {
        val withAudio = StoragePlanner.bytesForMinutes(StoragePlanner.DEFAULT_BITRATE_FHD, true, 40)
        val without = StoragePlanner.bytesForMinutes(StoragePlanner.DEFAULT_BITRATE_FHD, false, 40)
        assertTrue(without < withAudio)
    }

    @Test
    fun `録画開始には60分ぶんと2GBのマージンが要る`() {
        val required = StoragePlanner.requiredFreeBytes(StoragePlanner.DEFAULT_BITRATE_FHD, true)
        val sixty = StoragePlanner.bytesForMinutes(StoragePlanner.DEFAULT_BITRATE_FHD, true, 60)
        assertEquals(sixty + 2 * gb, required)
    }

    @Test
    fun `空き容量が少なければ録画可能分数は0になる`() {
        assertEquals(0, StoragePlanner.recordableMinutes(0, StoragePlanner.DEFAULT_BITRATE_FHD, true))
        assertEquals(
            0,
            StoragePlanner.recordableMinutes(500L * 1024 * 1024, StoragePlanner.DEFAULT_BITRATE_FHD, true),
        )
    }

    @Test
    fun `31GB空いていれば十分に録れる`() {
        val minutes = StoragePlanner.recordableMinutes(31 * gb, StoragePlanner.DEFAULT_BITRATE_FHD, true)
        assertTrue("実際=$minutes 分", minutes > 300)
    }
}
