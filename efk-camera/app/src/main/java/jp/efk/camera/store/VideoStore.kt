package jp.efk.camera.store

import android.content.Context
import jp.efk.camera.util.SafeLog
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import org.json.JSONArray
import org.json.JSONObject
import java.io.File

/**
 * 録画レコードの永続化。
 *
 * Room を使わず JSON ファイル1枚で持つ。件数はせいぜい数十件で、
 * アノテーションプロセッサを増やさない方がビルド再現性が高いため（設計書 8.4）。
 *
 * 書き込みは「一時ファイル → rename」で原子的に行う。
 * 途中で電源が落ちても、壊れた JSON が残らないようにするため。
 */
class VideoStore private constructor(context: Context) {

    private val appContext = context.applicationContext
    private val file = File(appContext.filesDir, FILE_NAME)
    private val lock = Any()

    private val _records = MutableStateFlow<List<VideoRecord>>(emptyList())
    val records: StateFlow<List<VideoRecord>> = _records.asStateFlow()

    init {
        synchronized(lock) { _records.value = load() }
    }

    fun all(): List<VideoRecord> = _records.value

    fun get(id: String): VideoRecord? = _records.value.firstOrNull { it.id == id }

    /** アップロードが必要なもの（古い順）。 */
    fun pending(): List<VideoRecord> =
        _records.value.filter { it.state.needsUpload }.sortedBy { it.startedAtEpochMs }

    fun put(record: VideoRecord) {
        synchronized(lock) {
            val next = _records.value.toMutableList()
            val idx = next.indexOfFirst { it.id == record.id }
            if (idx >= 0) next[idx] = record else next.add(record)
            next.sortBy { it.startedAtEpochMs }
            persist(next)
            _records.value = next
        }
    }

    /**
     * 既存レコードを読み直してから更新する。
     * 「別スレッドが先に状態を進めていた」場合の取りこぼしを防ぐ。
     * 変更後のレコードを返す（対象が無ければ null）。
     */
    fun update(id: String, mutator: (VideoRecord) -> VideoRecord): VideoRecord? {
        synchronized(lock) {
            val next = _records.value.toMutableList()
            val idx = next.indexOfFirst { it.id == id }
            if (idx < 0) return null
            val updated = mutator(next[idx])
            next[idx] = updated
            persist(next)
            _records.value = next
            return updated
        }
    }

    fun remove(id: String) {
        synchronized(lock) {
            val next = _records.value.filterNot { it.id == id }
            persist(next)
            _records.value = next
        }
    }

    // ------------------------------------------------------------------
    // 永続化
    // ------------------------------------------------------------------

    private fun persist(list: List<VideoRecord>) {
        val arr = JSONArray()
        list.forEach { arr.put(toJson(it)) }
        val tmp = File(file.parentFile, "$FILE_NAME.tmp")
        try {
            tmp.writeText(arr.toString())
            if (!tmp.renameTo(file)) {
                // rename に失敗したら直接書く（最後の手段）
                file.writeText(arr.toString())
                tmp.delete()
            }
        } catch (e: Exception) {
            SafeLog.e(TAG, "レコードの保存に失敗しました", e)
        }
    }

    private fun load(): List<VideoRecord> {
        if (!file.exists()) return emptyList()
        return try {
            val arr = JSONArray(file.readText())
            (0 until arr.length()).mapNotNull { i ->
                try {
                    fromJson(arr.getJSONObject(i))
                } catch (e: Exception) {
                    SafeLog.w(TAG, "壊れたレコードを1件読み飛ばしました", e)
                    null
                }
            }
        } catch (e: Exception) {
            SafeLog.e(TAG, "レコードの読み込みに失敗しました", e)
            emptyList()
        }
    }

    private fun toJson(r: VideoRecord): JSONObject = JSONObject().apply {
        put("id", r.id)
        put("sessionId", r.sessionId)
        put("filePath", r.filePath)
        put("matchName", r.matchName)
        put("startedAtEpochMs", r.startedAtEpochMs)
        put("durationMs", r.durationMs)
        put("sizeBytes", r.sizeBytes)
        put("part", r.part)
        put("totalParts", r.totalParts)
        put("state", r.state.name)
        put("uploadUrl", r.uploadUrl ?: JSONObject.NULL)
        put("uploadUrlCreatedAtEpochMs", r.uploadUrlCreatedAtEpochMs)
        put("uploadedBytes", r.uploadedBytes)
        put("videoId", r.videoId ?: JSONObject.NULL)
        put("privacyStatus", r.privacyStatus ?: JSONObject.NULL)
        put("verifiedAtEpochMs", r.verifiedAtEpochMs ?: JSONObject.NULL)
        put("fileDeletedAtEpochMs", r.fileDeletedAtEpochMs ?: JSONObject.NULL)
        put("lastError", r.lastError ?: JSONObject.NULL)
        put("attempts", r.attempts)
        put("orphan", r.orphan)
    }

    private fun fromJson(o: JSONObject): VideoRecord = VideoRecord(
        id = o.getString("id"),
        sessionId = o.optString("sessionId", ""),
        filePath = o.getString("filePath"),
        matchName = o.optString("matchName", ""),
        startedAtEpochMs = o.optLong("startedAtEpochMs", 0L),
        durationMs = o.optLong("durationMs", 0L),
        sizeBytes = o.optLong("sizeBytes", 0L),
        part = o.optInt("part", 1),
        totalParts = o.optInt("totalParts", 1),
        state = runCatching { UploadState.valueOf(o.optString("state")) }
            .getOrDefault(UploadState.PENDING_UPLOAD),
        uploadUrl = o.optStringOrNull("uploadUrl"),
        uploadUrlCreatedAtEpochMs = o.optLong("uploadUrlCreatedAtEpochMs", 0L),
        uploadedBytes = o.optLong("uploadedBytes", 0L),
        videoId = o.optStringOrNull("videoId"),
        privacyStatus = o.optStringOrNull("privacyStatus"),
        verifiedAtEpochMs = o.optLongOrNull("verifiedAtEpochMs"),
        fileDeletedAtEpochMs = o.optLongOrNull("fileDeletedAtEpochMs"),
        lastError = o.optStringOrNull("lastError"),
        attempts = o.optInt("attempts", 0),
        orphan = o.optBoolean("orphan", false),
    )

    private fun JSONObject.optStringOrNull(key: String): String? =
        if (isNull(key)) null else optString(key).takeIf { it.isNotEmpty() }

    private fun JSONObject.optLongOrNull(key: String): Long? =
        if (isNull(key)) null else optLong(key).takeIf { it != 0L }

    companion object {
        private const val TAG = "VideoStore"
        private const val FILE_NAME = "records.json"

        @Volatile
        private var instance: VideoStore? = null

        fun get(context: Context): VideoStore =
            instance ?: synchronized(this) {
                instance ?: VideoStore(context).also { instance = it }
            }
    }
}
