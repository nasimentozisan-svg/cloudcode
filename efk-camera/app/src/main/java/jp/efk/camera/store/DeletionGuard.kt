package jp.efk.camera.store

/**
 * ★ 本アプリで最も重要な安全装置。
 *
 * 元動画の削除は、以下を **すべて** 満たしたときだけ許可する。
 *
 *   1. videos.insert が成功し
 *   2. YouTube Video ID を取得でき
 *   3. videos.list による存在確認が取れ（= verifiedAt が入っている）
 *   4. その結果が端末内に保存されて state が VERIFIED になっている
 *   5. まだ削除していない
 *   6. 素性不明の取り残しファイル（orphan）ではない
 *
 * 1つでも欠けたら false を返す。迷ったら消さない。
 */
object DeletionGuard {

    fun canDeleteFile(record: VideoRecord): Boolean = reasonNotToDelete(record) == null

    /**
     * 削除してはいけない理由を返す。削除して良い場合のみ null。
     * UI とログの両方でこの文言を使う。
     */
    fun reasonNotToDelete(record: VideoRecord): String? {
        if (record.orphan) {
            return "素性不明の取り残しファイルのため自動削除しません"
        }
        if (record.state != UploadState.VERIFIED) {
            return "アップロード確認が完了していません（状態: ${record.state}）"
        }
        if (record.videoId.isNullOrBlank()) {
            return "YouTube Video ID を取得できていません"
        }
        val verified = record.verifiedAtEpochMs
        if (verified == null || verified <= 0L) {
            return "YouTube 上での存在確認が取れていません"
        }
        if (record.fileDeletedAtEpochMs != null) {
            return "すでに削除済みです"
        }
        return null
    }

    /**
     * 手動削除（ユーザー操作）を許可してよいか。
     * 未アップロードのものは、明示的な確認なしには消させない。
     */
    fun manualDeleteNeedsWarning(record: VideoRecord): Boolean =
        record.holdsFile && record.state != UploadState.DONE && record.state != UploadState.VERIFIED

    fun manualDeleteWarningText(record: VideoRecord): String = when (record.state) {
        UploadState.FAILED_PERMANENT ->
            "この動画は YouTube へのアップロードに失敗しています。削除すると復元できません。"
        UploadState.NEEDS_REVIEW ->
            "この動画はアップロード状況が不明です。削除すると復元できません。"
        else ->
            "この動画はまだ YouTube へアップロードされていません。削除すると復元できません。"
    }
}
