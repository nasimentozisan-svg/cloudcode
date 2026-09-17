package jp.efk.camera

import jp.efk.camera.upload.ResumableRange
import org.junit.Assert.assertEquals
import org.junit.Test

/**
 * 通信断からの再開位置がずれると、動画が壊れたまま上がってしまう。
 * 境界値を厳しく確認する。
 */
class ResumableRangeTest {

    @Test
    fun `308のRangeヘッダから受信済みバイト数を求める`() {
        assertEquals(12_346L, ResumableRange.bytesReceived("bytes=0-12345"))
        assertEquals(1L, ResumableRange.bytesReceived("bytes=0-0"))
        assertEquals(1_000L, ResumableRange.bytesReceived("bytes=0-999"))
    }

    @Test
    fun `Rangeヘッダが無ければ最初から送り直す`() {
        assertEquals(0L, ResumableRange.bytesReceived(null))
        assertEquals(0L, ResumableRange.bytesReceived(""))
        assertEquals(0L, ResumableRange.bytesReceived("   "))
        assertEquals(0L, ResumableRange.bytesReceived("bytes=0-"))
        assertEquals(0L, ResumableRange.bytesReceived("こわれた値"))
    }

    @Test
    fun `前後の空白や大文字小文字に耐える`() {
        assertEquals(101L, ResumableRange.bytesReceived("  bytes=0-100  "))
    }

    @Test
    fun `送信時のContent-Range`() {
        assertEquals("bytes 0-999/1000", ResumableRange.contentRange(0, 1000, 1000))
        assertEquals("bytes 500-999/1000", ResumableRange.contentRange(500, 500, 1000))
    }

    @Test
    fun `進捗問い合わせのContent-Range`() {
        assertEquals("bytes */2400000000", ResumableRange.queryRange(2_400_000_000L))
    }

    @Test(expected = IllegalArgumentException::class)
    fun `不正な範囲は弾く`() {
        ResumableRange.contentRange(-1, 100, 1000)
    }
}
