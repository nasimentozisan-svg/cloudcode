package jp.efk.camera.store

/**
 * 1本の録画ファイルの状態。
 *
 * ここは純粋な Kotlin のデータクラスにしておく（Android / JSON に依存させない）。
 * 削除判定 [DeletionGuard] を CI の Unit Test で必ず検証できるようにするため。
 */
data class VideoRecord(
    val id: String,
    val sessionId: String,
    val filePath: String,
    val matchName: String,
    val startedAtEpochMs: Long,
    val durationMs: Long = 0L,
    val sizeBytes: Long = 0L,
    val part: Int = 1,
    val totalParts: Int = 1,
    val state: UploadState = UploadState.PENDING_UPLOAD,
    /** 再開可能アップロードのセッションURL。通信断のあと続きから送るために保持する。 */
    val uploadUrl: String? = null,
    val uploadUrlCreatedAtEpochMs: Long = 0L,
    val uploadedBytes: Long = 0L,
    val videoId: String? = null,
    /** YouTube が実際に設定した公開範囲（API 制限で private になることがある）。 */
    val privacyStatus: String? = null,
    /** 存在確認まで完了した時刻。ここが入って初めて削除候補になる。 */
    val verifiedAtEpochMs: Long? = null,
    val fileDeletedAtEpochMs: Long? = null,
    val lastError: String? = null,
    val attempts: Int = 0,
    /** アプリのクラッシュ等で取り残され、起動時に拾ったファイル。自動削除の対象外。 */
    val orphan: Boolean = false,
) {
    val progress: Double
        get() = if (sizeBytes <= 0L) 0.0 else (uploadedBytes.toDouble() / sizeBytes).coerceIn(0.0, 1.0)

    val youtubeUrl: String?
        get() = videoId?.let { "https://www.youtube.com/watch?v=$it" }

    /** ファイルがまだ端末に残っているはず、という状態か。 */
    val holdsFile: Boolean
        get() = fileDeletedAtEpochMs == null
}

enum class UploadState {
    /** 録画済み。アップロード待ち。 */
    PENDING_UPLOAD,

    /** アップロード実行中。 */
    UPLOADING,

    /** videos.insert が成功し Video ID を取得した。まだ存在確認していない。 */
    UPLOADED,

    /** YouTube 上に存在することを確認済み。★ここで初めて削除してよい。 */
    VERIFIED,

    /** 元動画の削除まで完了。 */
    DONE,

    /** 再試行しても解決しない失敗（rejected 等）。ファイルは絶対に消さない。 */
    FAILED_PERMANENT,

    /** 起動時に拾った素性不明のファイル。人間の確認待ち。 */
    NEEDS_REVIEW,
    ;

    val isTerminal: Boolean get() = this == DONE || this == FAILED_PERMANENT || this == NEEDS_REVIEW
    val needsUpload: Boolean get() = this == PENDING_UPLOAD || this == UPLOADING || this == UPLOADED
}
