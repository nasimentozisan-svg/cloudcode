package jp.efk.camera

import jp.efk.camera.store.DeletionGuard
import jp.efk.camera.store.UploadState
import jp.efk.camera.store.VideoRecord
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNotNull
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test

/**
 * ★ 本アプリで最も重要なテスト。
 *
 * 「条件が揃っていないのに元動画を消してしまう」ことだけは絶対に起こしてはいけない。
 */
class DeletionGuardTest {

    private fun base(
        state: UploadState = UploadState.VERIFIED,
        videoId: String? = "abc123",
        verifiedAt: Long? = 1_700_000_000_000L,
        deletedAt: Long? = null,
        orphan: Boolean = false,
    ) = VideoRecord(
        id = "rec-1",
        sessionId = "s-1",
        filePath = "/tmp/rec-1.mp4",
        matchName = "テスト",
        startedAtEpochMs = 1_700_000_000_000L,
        state = state,
        videoId = videoId,
        verifiedAtEpochMs = verifiedAt,
        fileDeletedAtEpochMs = deletedAt,
        orphan = orphan,
    )

    @Test
    fun `4条件がすべて揃ったときだけ削除できる`() {
        val record = base()
        assertNull(DeletionGuard.reasonNotToDelete(record))
        assertTrue(DeletionGuard.canDeleteFile(record))
    }

    @Test
    fun `VERIFIED 以外の状態では絶対に削除しない`() {
        UploadState.entries
            .filter { it != UploadState.VERIFIED }
            .forEach { state ->
                val record = base(state = state)
                assertFalse(
                    "state=$state で削除が許可されてはいけない",
                    DeletionGuard.canDeleteFile(record),
                )
            }
    }

    @Test
    fun `Video ID が無ければ削除しない`() {
        assertFalse(DeletionGuard.canDeleteFile(base(videoId = null)))
        assertFalse(DeletionGuard.canDeleteFile(base(videoId = "")))
        assertFalse(DeletionGuard.canDeleteFile(base(videoId = "   ")))
    }

    @Test
    fun `存在確認の時刻が無ければ削除しない`() {
        assertFalse(DeletionGuard.canDeleteFile(base(verifiedAt = null)))
        assertFalse(DeletionGuard.canDeleteFile(base(verifiedAt = 0L)))
    }

    @Test
    fun `すでに削除済みなら二重に削除しない`() {
        assertFalse(DeletionGuard.canDeleteFile(base(deletedAt = 1_700_000_100_000L)))
    }

    @Test
    fun `取り残しファイルは条件が揃っていても自動削除しない`() {
        assertFalse(DeletionGuard.canDeleteFile(base(orphan = true)))
    }

    @Test
    fun `削除できない理由は必ず文章で返る`() {
        assertNotNull(DeletionGuard.reasonNotToDelete(base(state = UploadState.PENDING_UPLOAD)))
        assertNotNull(DeletionGuard.reasonNotToDelete(base(videoId = null)))
        assertNotNull(DeletionGuard.reasonNotToDelete(base(verifiedAt = null)))
    }

    @Test
    fun `未アップロードの手動削除には警告を出す`() {
        assertTrue(DeletionGuard.manualDeleteNeedsWarning(base(state = UploadState.PENDING_UPLOAD)))
        assertTrue(DeletionGuard.manualDeleteNeedsWarning(base(state = UploadState.UPLOADING)))
        assertTrue(DeletionGuard.manualDeleteNeedsWarning(base(state = UploadState.UPLOADED)))
        assertTrue(
            DeletionGuard.manualDeleteNeedsWarning(base(state = UploadState.FAILED_PERMANENT)),
        )
        assertTrue(DeletionGuard.manualDeleteNeedsWarning(base(state = UploadState.NEEDS_REVIEW)))
    }

    @Test
    fun `アップロード済みの手動削除には警告を出さない`() {
        assertFalse(DeletionGuard.manualDeleteNeedsWarning(base(state = UploadState.DONE)))
        assertFalse(DeletionGuard.manualDeleteNeedsWarning(base(state = UploadState.VERIFIED)))
    }

    @Test
    fun `状態のフラグが意図どおり`() {
        assertTrue(UploadState.PENDING_UPLOAD.needsUpload)
        assertTrue(UploadState.UPLOADING.needsUpload)
        assertTrue(UploadState.UPLOADED.needsUpload)
        assertFalse(UploadState.VERIFIED.needsUpload)
        assertFalse(UploadState.DONE.needsUpload)
        assertFalse(UploadState.FAILED_PERMANENT.needsUpload)
        assertFalse(UploadState.NEEDS_REVIEW.needsUpload)

        assertEquals(true, UploadState.DONE.isTerminal)
        assertEquals(true, UploadState.FAILED_PERMANENT.isTerminal)
    }
}
