package jp.efk.camera.upload

import jp.efk.camera.auth.GoogleAuthManager
import jp.efk.camera.store.VideoRecord
import jp.efk.camera.util.Fmt
import jp.efk.camera.util.SafeLog
import okhttp3.MediaType.Companion.toMediaType
import okhttp3.OkHttpClient
import okhttp3.Request
import okhttp3.RequestBody
import okhttp3.RequestBody.Companion.toRequestBody
import okhttp3.Response
import okio.BufferedSink
import org.json.JSONObject
import java.io.File
import java.io.IOException
import java.io.RandomAccessFile
import java.util.concurrent.TimeUnit

private const val TAG = "Upload"

private const val INITIATE_URL =
    "https://www.googleapis.com/upload/youtube/v3/videos?uploadType=resumable&part=snippet,status"
private const val VERIFY_URL = "https://www.googleapis.com/youtube/v3/videos"

private const val VIDEO_MIME = "video/mp4"
private val VIDEO_MEDIA_TYPE = VIDEO_MIME.toMediaType()
private val JSON_MIME = "application/json; charset=utf-8".toMediaType()

private val EMPTY_BODY: RequestBody = object : RequestBody() {
    override fun contentType() = null
    override fun contentLength(): Long = 0L
    override fun writeTo(sink: BufferedSink) = Unit
}

/** Google のアップロードURLは概ね1週間有効。余裕を持って6日で作り直す。 */
private const val UPLOAD_URL_TTL_MS = 6L * 24 * 60 * 60 * 1000

/**
 * YouTube Data API v3 への再開可能アップロード（設計書 4.1）。
 *
 * 公式クライアントライブラリを使わず自前で実装しているのは、
 * **アップロードURLをプロセスをまたいで永続化するため**。
 * これがないと「Wi-Fiが切れた」だけで 2.4GB を最初からやり直すことになる。
 */
class YouTubeUploader(private val auth: GoogleAuthManager) {

    private val client = OkHttpClient.Builder()
        .connectTimeout(30, TimeUnit.SECONDS)
        .readTimeout(120, TimeUnit.SECONDS)
        // 大きなファイルを1本の PUT で送るため、書き込みと全体はタイムアウトさせない
        .writeTimeout(0, TimeUnit.MILLISECONDS)
        .callTimeout(0, TimeUnit.MILLISECONDS)
        .retryOnConnectionFailure(true)
        .build()

    sealed class Outcome {
        /** アップロード成功。Video ID を取得できた。 */
        data class Success(val videoId: String, val privacyStatus: String?) : Outcome()

        /** 一時的な失敗。あとで続きから再試行してよい。 */
        data class Retry(val message: String, val newUploadUrl: String? = null) : Outcome()

        /** 再試行しても解決しない失敗。ファイルは絶対に消さない。 */
        data class Permanent(val message: String) : Outcome()

        /** 人の操作（Google の同意など）が必要。 */
        data class NeedsUser(val message: String) : Outcome()
    }

    data class Verification(
        val exists: Boolean,
        val uploadStatus: String?,
        val privacyStatus: String?,
        val permanentFailure: Boolean,
        val message: String?,
    )

    /**
     * アップロードを進める。中断されていれば続きから再開する。
     *
     * @param onUploadUrl 新しいアップロードURLを取得したときに呼ばれる。必ず永続化すること。
     * @param onProgress  送信済みバイト数（累計）。進捗表示と再開位置の記録に使う。
     */
    fun run(
        record: VideoRecord,
        onUploadUrl: (String) -> Unit,
        onProgress: (Long) -> Unit,
    ): Outcome {
        val file = File(record.filePath)
        if (!file.exists() || file.length() <= 0L) {
            return Outcome.Permanent("録画ファイルが見つかりません")
        }
        val total = file.length()

        val token = try {
            auth.accessTokenBlocking()
        } catch (e: GoogleAuthManager.AuthNotReady) {
            return Outcome.NeedsUser(e.message ?: "Google 認証が必要です")
        } catch (e: IOException) {
            return Outcome.Retry("Google 認証サーバに接続できません")
        }

        // ---- ① アップロードURLを用意する（無ければ作る）----
        var uploadUrl: String = record.uploadUrl?.takeIf { !isUploadUrlExpired(record) }
            ?: run {
                val initiated = initiateUploadUrl(token, record, total)
                initiated.error?.let { return it }
                val url = initiated.url ?: return Outcome.Retry("アップロードURLを取得できませんでした")
                onUploadUrl(url)
                url
            }

        // ---- ② どこまで受け取られているか確認する ----
        var offset: Long
        when (val q = queryOffset(token, uploadUrl, total)) {
            is QueryResult.Completed -> return Outcome.Success(q.videoId, q.privacyStatus)
            is QueryResult.Incomplete -> offset = q.received.coerceIn(0L, total)
            is QueryResult.Expired -> {
                SafeLog.w(TAG, "アップロードURLが失効していたので作り直します")
                val initiated = initiateUploadUrl(token, record, total)
                initiated.error?.let { return it }
                uploadUrl = initiated.url
                    ?: return Outcome.Retry("アップロードURLを取得できませんでした")
                onUploadUrl(uploadUrl)
                offset = 0L
            }
            is QueryResult.Failed -> return q.outcome
        }
        onProgress(offset)

        if (offset >= total) {
            // 全部送ったのに完了応答が無い＝もう一度確認させる
            return Outcome.Retry("アップロードの完了確認待ちです")
        }

        // ---- ③ 残りを送る ----
        val count = total - offset
        val body = FileRangeBody(file, offset, count) { sent ->
            onProgress(offset + sent)
        }
        val request = Request.Builder()
            .url(uploadUrl)
            .header("Authorization", "Bearer $token")
            .header("Content-Range", ResumableRange.contentRange(offset, count, total))
            .put(body)
            .build()

        return try {
            client.newCall(request).execute().use { res -> interpretUploadResponse(res, token) }
        } catch (e: IOException) {
            SafeLog.w(TAG, "アップロード中に通信が切れました。続きから再試行します", e)
            Outcome.Retry("通信が切れました。ネットワーク復旧後に続きから再開します")
        }
    }

    // ------------------------------------------------------------------

    private class Initiated(val url: String?, val error: Outcome?)

    private fun initiateUploadUrl(token: String, record: VideoRecord, total: Long): Initiated {
        val metadata = buildMetadata(record)
        val request = Request.Builder()
            .url(INITIATE_URL)
            .header("Authorization", "Bearer $token")
            .header("X-Upload-Content-Length", total.toString())
            .header("X-Upload-Content-Type", VIDEO_MIME)
            .post(metadata.toString().toRequestBody(JSON_MIME))
            .build()
        return try {
            client.newCall(request).execute().use { res ->
                when {
                    res.isSuccessful -> {
                        val location = res.header("Location")
                        if (location.isNullOrBlank()) {
                            Initiated(null, Outcome.Retry("アップロードURLを取得できませんでした"))
                        } else {
                            Initiated(location, null)
                        }
                    }
                    res.code == 401 -> {
                        auth.invalidate(token)
                        Initiated(null, Outcome.Retry("認証の有効期限が切れました。やり直します"))
                    }
                    else -> Initiated(null, classifyError(res))
                }
            }
        } catch (e: IOException) {
            Initiated(null, Outcome.Retry("YouTube に接続できませんでした"))
        }
    }

    private sealed class QueryResult {
        data class Completed(val videoId: String, val privacyStatus: String?) : QueryResult()
        data class Incomplete(val received: Long) : QueryResult()
        object Expired : QueryResult()
        data class Failed(val outcome: Outcome) : QueryResult()
    }

    private fun queryOffset(token: String, uploadUrl: String, total: Long): QueryResult {
        val request = Request.Builder()
            .url(uploadUrl)
            .header("Authorization", "Bearer $token")
            .header("Content-Range", ResumableRange.queryRange(total))
            .put(EMPTY_BODY)
            .build()
        return try {
            client.newCall(request).execute().use { res ->
                when {
                    res.code == 308 -> QueryResult.Incomplete(
                        ResumableRange.bytesReceived(res.header("Range")),
                    )
                    res.isSuccessful -> {
                        val parsed = parseVideo(res.body?.string())
                        if (parsed == null) {
                            QueryResult.Failed(Outcome.Retry("応答を解釈できませんでした"))
                        } else {
                            QueryResult.Completed(parsed.first, parsed.second)
                        }
                    }
                    res.code == 404 || res.code == 410 -> QueryResult.Expired
                    res.code == 401 -> {
                        auth.invalidate(token)
                        QueryResult.Failed(Outcome.Retry("認証の有効期限が切れました。やり直します"))
                    }
                    else -> QueryResult.Failed(classifyError(res))
                }
            }
        } catch (e: IOException) {
            QueryResult.Failed(Outcome.Retry("YouTube に接続できませんでした"))
        }
    }

    private fun interpretUploadResponse(res: Response, token: String): Outcome = when {
        res.isSuccessful -> {
            val parsed = parseVideo(res.body?.string())
            if (parsed == null) {
                Outcome.Retry("アップロードの応答を解釈できませんでした")
            } else {
                SafeLog.i(TAG, "アップロードが完了しました")
                Outcome.Success(parsed.first, parsed.second)
            }
        }
        res.code == 308 -> Outcome.Retry("送信が途中で終わりました。続きから再開します")
        res.code == 401 -> {
            auth.invalidate(token)
            Outcome.Retry("認証の有効期限が切れました。やり直します")
        }
        else -> classifyError(res)
    }

    private fun classifyError(res: Response): Outcome {
        val bodyText = runCatching { res.body?.string() }.getOrNull().orEmpty()
        val reason = extractReason(bodyText)
        val summary = "YouTube API エラー (HTTP ${res.code}${if (reason != null) " / $reason" else ""})"
        SafeLog.w(TAG, summary)
        return when {
            res.code in 500..599 -> Outcome.Retry("$summary。時間をおいて再試行します")
            res.code == 429 -> Outcome.Retry("$summary。時間をおいて再試行します")
            reason == "quotaExceeded" || reason == "uploadLimitExceeded" ->
                Outcome.Retry("$summary。本日のアップロード上限に達している可能性があります")
            reason == "rateLimitExceeded" || reason == "backendError" ->
                Outcome.Retry("$summary。時間をおいて再試行します")
            res.code == 403 -> Outcome.Permanent("$summary。権限またはクォータの設定を確認してください")
            res.code in 400..499 -> Outcome.Permanent(summary)
            else -> Outcome.Retry(summary)
        }
    }

    private fun extractReason(body: String): String? = try {
        JSONObject(body)
            .optJSONObject("error")
            ?.optJSONArray("errors")
            ?.optJSONObject(0)
            ?.optString("reason")
            ?.takeIf { it.isNotBlank() }
    } catch (e: Exception) {
        null
    }

    /** 応答 JSON から (videoId, privacyStatus) を取り出す。 */
    private fun parseVideo(body: String?): Pair<String, String?>? {
        if (body.isNullOrBlank()) return null
        return try {
            val o = JSONObject(body)
            val id = o.optString("id").takeIf { it.isNotBlank() } ?: return null
            val privacy = o.optJSONObject("status")?.optString("privacyStatus")
                ?.takeIf { it.isNotBlank() }
            id to privacy
        } catch (e: Exception) {
            SafeLog.w(TAG, "応答 JSON を解釈できませんでした", e)
            null
        }
    }

    // ------------------------------------------------------------------
    // 存在確認（★ 削除の前提条件）
    // ------------------------------------------------------------------

    /**
     * videos.list で「本当に YouTube 上にあるか」を確認する。
     * ここが成功しない限り、元動画は絶対に削除しない（設計書 7.1）。
     */
    fun verify(videoId: String): Verification {
        val token = try {
            auth.accessTokenBlocking()
        } catch (e: GoogleAuthManager.AuthNotReady) {
            return Verification(false, null, null, false, e.message)
        } catch (e: IOException) {
            return Verification(false, null, null, false, "認証サーバに接続できません")
        }

        val url = "$VERIFY_URL?part=status&id=$videoId"
        val request = Request.Builder()
            .url(url)
            .header("Authorization", "Bearer $token")
            .get()
            .build()

        return try {
            client.newCall(request).execute().use { res ->
                if (res.code == 401) {
                    auth.invalidate(token)
                    return Verification(false, null, null, false, "認証の有効期限が切れました")
                }
                if (!res.isSuccessful) {
                    return Verification(false, null, null, false, "確認に失敗しました (HTTP ${res.code})")
                }
                val o = JSONObject(res.body?.string().orEmpty())
                val items = o.optJSONArray("items")
                if (items == null || items.length() == 0) {
                    return Verification(false, null, null, false, "YouTube 上に動画が見つかりません")
                }
                val status = items.optJSONObject(0)?.optJSONObject("status")
                val uploadStatus = status?.optString("uploadStatus")?.takeIf { it.isNotBlank() }
                val privacy = status?.optString("privacyStatus")?.takeIf { it.isNotBlank() }
                val failureReason = status?.optString("failureReason")?.takeIf { it.isNotBlank() }
                val rejectionReason = status?.optString("rejectionReason")?.takeIf { it.isNotBlank() }

                when (uploadStatus) {
                    "processed", "uploaded" ->
                        Verification(true, uploadStatus, privacy, false, null)
                    "rejected" -> Verification(
                        false, uploadStatus, privacy, true,
                        "YouTube に拒否されました（理由: ${rejectionReason ?: "不明"}）。元動画は削除しません",
                    )
                    "failed" -> Verification(
                        false, uploadStatus, privacy, false,
                        "YouTube 側の処理に失敗しました（理由: ${failureReason ?: "不明"}）",
                    )
                    else -> Verification(
                        false, uploadStatus, privacy, false,
                        "処理状態を確認できませんでした（$uploadStatus）",
                    )
                }
            }
        } catch (e: Exception) {
            Verification(false, null, null, false, "確認中に通信エラーが発生しました")
        }
    }

    // ------------------------------------------------------------------

    private fun isUploadUrlExpired(record: VideoRecord): Boolean {
        val created = record.uploadUrlCreatedAtEpochMs
        if (created <= 0L) return true
        return System.currentTimeMillis() - created > UPLOAD_URL_TTL_MS
    }

    private fun buildMetadata(record: VideoRecord): JSONObject {
        val title = Fmt.buildTitle(
            record.startedAtEpochMs,
            record.matchName,
            record.part,
            record.totalParts,
        )
        val description = buildString {
            appendLine("エンフレンテ熊本フットサルクラブ")
            appendLine("撮影日時: ${Fmt.dateTime(record.startedAtEpochMs)}")
            appendLine("録画時間: ${Fmt.duration(record.durationMs)}")
            if (record.totalParts > 1) {
                appendLine("パート: ${record.part}/${record.totalParts}")
            }
            appendLine("EFK CAMERA で撮影")
        }
        return JSONObject().apply {
            put(
                "snippet",
                JSONObject().apply {
                    put("title", title)
                    put("description", description)
                    // 22 = People & Blogs（スポーツ枠より無難な既定。必要なら 17 = Sports）
                    put("categoryId", "17")
                },
            )
            put(
                "status",
                JSONObject().apply {
                    // 常に限定公開を要求する。
                    // 未監査プロジェクトでは YouTube 側が private に落とすが、
                    // それはエラーにせず、あとで実際の値を読み戻して表示する（設計書 5.3）。
                    put("privacyStatus", "unlisted")
                    put("selfDeclaredMadeForKids", false)
                },
            )
        }
    }

    /** ファイルの一部分だけを、進捗を報告しながら送る RequestBody。 */
    private class FileRangeBody(
        private val file: File,
        private val offset: Long,
        private val count: Long,
        private val onProgress: (Long) -> Unit,
    ) : RequestBody() {

        override fun contentType() = VIDEO_MEDIA_TYPE

        override fun contentLength(): Long = count

        override fun writeTo(sink: BufferedSink) {
            RandomAccessFile(file, "r").use { raf ->
                raf.seek(offset)
                val buffer = ByteArray(CHUNK)
                var sent = 0L
                var lastReport = 0L
                while (sent < count) {
                    val want = minOf(CHUNK.toLong(), count - sent).toInt()
                    val n = raf.read(buffer, 0, want)
                    if (n <= 0) break
                    sink.write(buffer, 0, n)
                    sent += n
                    if (sent - lastReport >= REPORT_EVERY || sent == count) {
                        lastReport = sent
                        onProgress(sent)
                    }
                }
            }
        }

        companion object {
            private const val CHUNK = 256 * 1024
            private const val REPORT_EVERY = 2L * 1024 * 1024
        }
    }
}
