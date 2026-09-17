package jp.efk.camera.store

import jp.efk.camera.util.Fmt
import jp.efk.camera.util.SafeLog
import java.io.File

/**
 * 録画フォルダを走査し、DB に載っていないファイルを拾う。
 *
 * アプリがクラッシュした直後などに発生しうる。
 * ★ 自動削除は絶対にしない。NEEDS_REVIEW として登録し、人間に判断させる（設計書 7.3）。
 */
object OrphanScanner {

    fun scan(dir: File, store: VideoStore): Int {
        if (!dir.exists()) return 0
        val known = store.all().map { File(it.filePath).absolutePath }.toSet()
        val files = dir.listFiles { f -> f.isFile && f.name.endsWith(".mp4") } ?: return 0

        var found = 0
        for (file in files) {
            if (file.absolutePath in known) continue
            if (file.length() < MIN_BYTES) {
                // 中身の無い書きかけファイルは登録しても意味がないので消す
                runCatching { file.delete() }
                continue
            }
            val recorded = file.lastModified()
            val record = VideoRecord(
                id = "orphan-" + Fmt.fileStamp(recorded) + "-" + file.name.hashCode().toUInt(),
                sessionId = "orphan",
                filePath = file.absolutePath,
                matchName = "録画（要確認）",
                startedAtEpochMs = recorded,
                sizeBytes = file.length(),
                state = UploadState.NEEDS_REVIEW,
                orphan = true,
                lastError = "アプリの異常終了などで取り残された可能性があります。" +
                    "内容を確認してから手動で操作してください",
            )
            store.put(record)
            found++
        }
        if (found > 0) {
            SafeLog.w(TAG, "取り残しファイルを ${found}件 登録しました（自動削除はしません）")
        }
        return found
    }

    private const val TAG = "Orphan"
    private const val MIN_BYTES = 200_000L
}
