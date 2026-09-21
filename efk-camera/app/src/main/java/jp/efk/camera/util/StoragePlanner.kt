package jp.efk.camera.util

/**
 * 録画に必要な空き容量の見積り。純粋関数。
 *
 * 「録画の途中で容量が尽きる」ことを防ぐため、
 * 実際に想定している時間より長め（既定60分）＋固定マージンで判定する。
 */
object StoragePlanner {

    /**
     * 1ファイルの上限。Android の MP4 出力は端末により 4GiB 前後で頭打ちになるため、
     * その手前で区切って次のパートへ自動継続する（設計書 2.3）。
     * 3.9e9 バイト = 約3.63GiB。1080p/8Mbps なら約62分ぶん入るので、
     * 通常の試合（20〜40分）が分割されることはない。
     */
    const val MAX_PART_BYTES = 3_900_000_000L

    /**
     * 1080p30 の既定ビットレート。
     * 端末既定（17〜20Mbps）のままだと40分で4GiBの壁に当たるため明示的に落としている。
     * 40分で約2.4GB（設計書 2.2）。
     */
    const val DEFAULT_BITRATE_FHD = 8_000_000

    /** 720p30 の既定ビットレート。40分で約1.5GB。 */
    const val DEFAULT_BITRATE_HD = 5_000_000

    /** 音声込みの実効ビットレート（映像 + AAC 128kbps + コンテナのオーバーヘッド）。 */
    fun effectiveBitsPerSecond(videoBitrateBps: Int, audioEnabled: Boolean): Long {
        val audio = if (audioEnabled) 128_000L else 0L
        return ((videoBitrateBps + audio) * 1.03).toLong()
    }

    /** 指定分数の録画に必要なバイト数。 */
    fun bytesForMinutes(videoBitrateBps: Int, audioEnabled: Boolean, minutes: Int): Long =
        effectiveBitsPerSecond(videoBitrateBps, audioEnabled) * minutes * 60L / 8L

    /**
     * 録画開始に必要な空き容量。
     * 既定では「60分ぶん + 2GB のマージン」。
     */
    fun requiredFreeBytes(
        videoBitrateBps: Int,
        audioEnabled: Boolean,
        planMinutes: Int = 60,
        marginBytes: Long = 2L * 1024 * 1024 * 1024,
    ): Long = bytesForMinutes(videoBitrateBps, audioEnabled, planMinutes) + marginBytes

    /** いまの空き容量で何分録れるか（マージンを差し引いた実用値）。 */
    fun recordableMinutes(
        freeBytes: Long,
        videoBitrateBps: Int,
        audioEnabled: Boolean,
        marginBytes: Long = 1L * 1024 * 1024 * 1024,
    ): Int {
        val usable = freeBytes - marginBytes
        if (usable <= 0) return 0
        val bps = effectiveBitsPerSecond(videoBitrateBps, audioEnabled)
        if (bps <= 0) return 0
        return (usable * 8L / bps / 60L).toInt()
    }
}
