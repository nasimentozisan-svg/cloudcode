package jp.efk.camera.upload

/**
 * 再開可能アップロードのヘッダ操作。純粋関数なので CI の Unit Test で検証する。
 */
object ResumableRange {

    /**
     * 308 応答の `Range: bytes=0-12345` から「受信済みバイト数」を求める。
     * ヘッダが無い場合は 0（= 最初から送り直す）。
     */
    fun bytesReceived(rangeHeader: String?): Long {
        if (rangeHeader.isNullOrBlank()) return 0L
        val value = rangeHeader.trim().removePrefix("bytes=").trim()
        val end = value.substringAfter('-', "").trim()
        if (end.isEmpty()) return 0L
        val last = end.toLongOrNull() ?: return 0L
        if (last < 0L) return 0L
        return last + 1L
    }

    /** 送信時の `Content-Range: bytes 100-999/1000`。 */
    fun contentRange(offset: Long, count: Long, total: Long): String {
        require(total > 0) { "total must be positive" }
        require(offset >= 0) { "offset must not be negative" }
        require(count > 0) { "count must be positive" }
        val last = offset + count - 1
        return "bytes $offset-$last/$total"
    }

    /** 進捗問い合わせ時の `Content-Range: bytes * /1000`。 */
    fun queryRange(total: Long): String = "bytes */$total"
}
