package jp.efk.camera

import jp.efk.camera.util.Fmt
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test
import java.util.TimeZone

class FmtTest {

    private val jst = TimeZone.getTimeZone("Asia/Tokyo")

    /** 2026-09-17 12:00:00 JST */
    private val sample = 1789614000000L

    @Test
    fun `タイトルは日付 + 試合名になる`() {
        assertEquals(
            "2026-09-17 GRTIA CUP U18 vs ○○高校",
            Fmt.buildTitle(sample, "GRTIA CUP U18 vs ○○高校", 1, 1, jst),
        )
    }

    @Test
    fun `試合名が空なら補完する`() {
        assertEquals("2026-09-17 試合", Fmt.buildTitle(sample, "", 1, 1, jst))
        assertEquals("2026-09-17 試合", Fmt.buildTitle(sample, null, 1, 1, jst))
        assertEquals("2026-09-17 試合", Fmt.buildTitle(sample, "   ", 1, 1, jst))
    }

    @Test
    fun `前後の空白は落とす`() {
        assertEquals("2026-09-17 九州リーグ", Fmt.buildTitle(sample, "  九州リーグ  ", 1, 1, jst))
    }

    @Test
    fun `分割したときだけパート番号が付く`() {
        assertEquals("2026-09-17 練習試合", Fmt.buildTitle(sample, "練習試合", 1, 1, jst))
        assertEquals("2026-09-17 練習試合 (1/2)", Fmt.buildTitle(sample, "練習試合", 1, 2, jst))
        assertEquals("2026-09-17 練習試合 (2/2)", Fmt.buildTitle(sample, "練習試合", 2, 2, jst))
    }

    @Test
    fun `YouTube の100文字制限を超えない`() {
        val long = "あ".repeat(300)
        val title = Fmt.buildTitle(sample, long, 1, 2, jst)
        assertTrue("実際の長さ=${title.length}", title.length <= Fmt.MAX_TITLE)
        assertTrue(title.startsWith("2026-09-17 "))
        assertTrue(title.endsWith(" (1/2)"))
    }

    @Test
    fun `経過時間は00formatになる`() {
        assertEquals("00:00:00", Fmt.duration(0))
        assertEquals("00:00:00", Fmt.duration(-500))
        assertEquals("00:00:59", Fmt.duration(59_999))
        assertEquals("00:18:42", Fmt.duration(18 * 60_000L + 42_000L))
        assertEquals("01:00:00", Fmt.duration(3_600_000L))
        assertEquals("10:00:00", Fmt.duration(36_000_000L))
    }

    @Test
    fun `バイト表記`() {
        assertEquals("512 B", Fmt.bytes(512))
        assertEquals("2 KB", Fmt.bytes(2048))
        assertEquals("1.0 GB", Fmt.bytes(1024L * 1024 * 1024))
        assertEquals("2.4 GB", Fmt.bytes((2.4 * 1024 * 1024 * 1024).toLong()))
    }

    @Test
    fun `ファイル名スタンプ`() {
        assertEquals("20260917-120000", Fmt.fileStamp(sample, jst))
    }
}
