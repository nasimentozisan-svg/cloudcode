package jp.efk.camera.util

import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale
import java.util.TimeZone

/**
 * 表示・タイトル生成のための純粋関数群。Android に依存しない。
 */
object Fmt {

    /** 動画タイトルに使う日付（端末のタイムゾーン）。 */
    fun dateStamp(epochMs: Long, tz: TimeZone = TimeZone.getDefault()): String {
        val f = SimpleDateFormat("yyyy-MM-dd", Locale.JAPAN)
        f.timeZone = tz
        return f.format(Date(epochMs))
    }

    /** ファイル名に使うタイムスタンプ。 */
    fun fileStamp(epochMs: Long, tz: TimeZone = TimeZone.getDefault()): String {
        val f = SimpleDateFormat("yyyyMMdd-HHmmss", Locale.JAPAN)
        f.timeZone = tz
        return f.format(Date(epochMs))
    }

    fun dateTime(epochMs: Long, tz: TimeZone = TimeZone.getDefault()): String {
        val f = SimpleDateFormat("yyyy-MM-dd HH:mm", Locale.JAPAN)
        f.timeZone = tz
        return f.format(Date(epochMs))
    }

    /**
     * YouTube 動画タイトルを組み立てる。
     *
     *   2026-09-17 GRTIA CUP U18 vs ○○高校
     *
     * 分割された場合のみ末尾にパート番号が付く。
     *   2026-09-17 GRTIA CUP U18 vs ○○高校 (1/2)
     *
     * YouTube のタイトル上限は 100 文字なので、超える場合は試合名側を詰める。
     */
    fun buildTitle(
        startedAtEpochMs: Long,
        matchName: String?,
        part: Int = 1,
        totalParts: Int = 1,
        tz: TimeZone = TimeZone.getDefault(),
    ): String {
        val date = dateStamp(startedAtEpochMs, tz)
        val name = matchName?.trim().let { if (it.isNullOrEmpty()) "試合" else it }
        val suffix = if (totalParts > 1) " ($part/$totalParts)" else ""
        val budget = MAX_TITLE - date.length - 1 - suffix.length
        val trimmed = if (name.length > budget && budget > 1) {
            name.take(budget - 1) + "…"
        } else {
            name
        }
        return "$date $trimmed$suffix"
    }

    const val MAX_TITLE = 100

    /** 00:00:00 形式。 */
    fun duration(ms: Long): String {
        val total = (if (ms < 0) 0 else ms) / 1000
        val h = total / 3600
        val m = (total % 3600) / 60
        val s = total % 60
        return String.format(Locale.US, "%02d:%02d:%02d", h, m, s)
    }

    /** 人が読めるバイト数。 */
    fun bytes(b: Long): String {
        if (b < 1024) return "$b B"
        val kb = b / 1024.0
        if (kb < 1024) return String.format(Locale.US, "%.0f KB", kb)
        val mb = kb / 1024.0
        if (mb < 1024) return String.format(Locale.US, "%.0f MB", mb)
        val gb = mb / 1024.0
        return String.format(Locale.US, "%.1f GB", gb)
    }
}
