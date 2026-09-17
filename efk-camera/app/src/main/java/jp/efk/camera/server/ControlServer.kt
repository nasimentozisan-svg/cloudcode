package jp.efk.camera.server

import android.content.Context
import android.os.Build
import fi.iki.elonen.NanoHTTPD
import fi.iki.elonen.NanoHTTPD.IHTTPSession
import fi.iki.elonen.NanoHTTPD.Response
import fi.iki.elonen.NanoHTTPD.newChunkedResponse
import fi.iki.elonen.NanoHTTPD.newFixedLengthResponse
import jp.efk.camera.BuildConfig
import jp.efk.camera.camera.PreviewHub
import jp.efk.camera.core.AppState
import jp.efk.camera.core.Prefs
import jp.efk.camera.core.RecState
import jp.efk.camera.store.DeletionGuard
import jp.efk.camera.store.UploadState
import jp.efk.camera.store.VideoStore
import jp.efk.camera.util.Fmt
import jp.efk.camera.util.SafeLog
import org.json.JSONArray
import org.json.JSONObject
import java.io.InputStream

private const val TAG = "Server"
private const val TOKEN_HEADER = "x-efk-token"
private const val TOKEN_QUERY = "t"
private const val COOKIE_NAME = "efk_token"
private const val COOKIE_MAX_AGE = 60 * 60 * 24 * 365
private const val BOUNDARY = "efkframe"
private const val STREAM_TIMEOUT_MS = 10_000L
private const val MAX_FRAMES_PER_STREAM = 2_000
private const val MAX_UPLOAD_ROWS = 50

/**
 * 使うステータスを自前で定義する。
 * NanoHTTPD のバージョンによって Status enum の顔ぶれが違うため、
 * そこに依存しないようにしておく。
 */
private enum class Http(private val code: Int, private val text: String) : Response.IStatus {
    OK(200, "OK"),
    BAD_REQUEST(400, "Bad Request"),
    UNAUTHORIZED(401, "Unauthorized"),
    FORBIDDEN(403, "Forbidden"),
    NOT_FOUND(404, "Not Found"),
    TOO_MANY_REQUESTS(429, "Too Many Requests"),
    INTERNAL_ERROR(500, "Internal Server Error"),
    SERVICE_UNAVAILABLE(503, "Service Unavailable"),
    ;

    override fun getDescription(): String = "$code $text"

    override fun getRequestStatus(): Int = code
}

/**
 * 端末内 HTTP サーバ。操作端末のブラウザはこれだけを見る。
 *
 * セキュリティ（設計書 3.4）
 *   1. プライベートIP以外からの接続は 403
 *   2. ペアリング以外の API はトークン必須
 *   3. PIN は5回失敗で10分ロック
 *
 * ★ このサーバは状態を配るだけで、接続の有無を録画制御に使わない。
 *   操作端末が切れても録画は続く。
 */
class ControlServer(
    private val context: Context,
    port: Int,
    private val host: Host,
) : NanoHTTPD(port) {

    interface Host {
        /** 成功なら null、失敗なら理由を返す。 */
        fun startRecording(matchName: String): String?
        fun stopRecording(): String?
        fun applySettings(body: JSONObject): String?
        fun retryUpload(id: String): String?
        fun deleteRecord(id: String, confirmed: Boolean): String?
        fun previewHub(): PreviewHub?
    }

    private val prefs = Prefs.get(context)
    private val store = VideoStore.get(context)
    val auth: AuthTokens = AuthTokens.get(prefs)

    override fun serve(session: IHTTPSession): Response {
        return try {
            handle(session)
        } catch (e: Exception) {
            SafeLog.e(TAG, "リクエスト処理に失敗しました uri=${session.uri}", e)
            errorJson(Http.INTERNAL_ERROR, "サーバ内部エラー")
        }
    }

    private fun handle(session: IHTTPSession): Response {
        val remote = session.remoteIpAddress
        if (!NetworkUtils.isPrivateAddress(remote)) {
            SafeLog.w(TAG, "LAN外からの接続を拒否しました")
            return errorJson(Http.FORBIDDEN, "同一LAN内からのみ利用できます")
        }

        val uri = session.uri.substringBefore('?')

        // --- 認証不要 ---
        if (!uri.startsWith("/api/")) return serveAsset(uri)
        if (uri == "/api/info") return apiInfo()
        if (uri == "/api/pair") return apiPair(session)

        // --- ここから認証必須 ---
        if (!isAuthorized(session)) {
            return errorJson(Http.UNAUTHORIZED, "ペアリングが必要です")
        }

        return when (uri) {
            "/api/status" -> json(buildStatus())
            "/api/record/start" -> apiStart(session)
            "/api/record/stop" -> apiStop()
            "/api/settings" -> apiSettings(session)
            "/api/uploads/retry" -> apiRetry(session)
            "/api/uploads/delete" -> apiDelete(session)
            "/api/preview.mjpg" -> apiPreviewStream()
            "/api/preview.jpg" -> apiPreviewFrame()
            "/api/unpair" -> apiUnpair()
            else -> errorJson(Http.NOT_FOUND, "不明なAPIです")
        }
    }

    // ------------------------------------------------------------------
    // 認証
    // ------------------------------------------------------------------

    private fun isAuthorized(session: IHTTPSession): Boolean {
        val header = session.headers[TOKEN_HEADER]
        if (auth.isValid(header)) return true

        val query = session.parameters[TOKEN_QUERY]?.firstOrNull()
        if (auth.isValid(query)) return true

        val cookie = session.headers["cookie"] ?: return false
        val token = cookie.split(';')
            .map { it.trim() }
            .firstOrNull { it.startsWith("$COOKIE_NAME=") }
            ?.substringAfter('=')
        return auth.isValid(token)
    }

    private fun apiInfo(): Response = json(
        JSONObject().apply {
            put("app", "EFK CAMERA")
            put("deviceName", prefs.deviceName)
            put("version", BuildConfig.VERSION_NAME)
            put("pairingLocked", auth.isLocked())
            put("lockRemainingMs", auth.remainingLockMs())
        },
    )

    private fun apiPair(session: IHTTPSession): Response {
        val body = readJsonBody(session)
        if (auth.isLocked()) {
            val min = (auth.remainingLockMs() / 60_000L) + 1
            return errorJson(
                Http.TOO_MANY_REQUESTS,
                "PINの入力を一時的に受け付けていません。約${min}分後にやり直してください",
            )
        }
        val token = auth.pair(body.optString("pin"))
            ?: return errorJson(
                Http.UNAUTHORIZED,
                "PINが違います（残り${auth.remainingAttempts()}回）",
            )

        SafeLog.i(TAG, "操作端末をペアリングしました（合計 ${auth.pairedCount()} 台）")
        val res = json(JSONObject().put("ok", true))
        res.addHeader(
            "Set-Cookie",
            "$COOKIE_NAME=$token; Path=/; Max-Age=$COOKIE_MAX_AGE; HttpOnly; SameSite=Lax",
        )
        return res
    }

    private fun apiUnpair(): Response {
        auth.revokeAll()
        return json(JSONObject().put("ok", true))
    }

    // ------------------------------------------------------------------
    // 操作
    // ------------------------------------------------------------------

    private fun apiStart(session: IHTTPSession): Response {
        val body = readJsonBody(session)
        val name = body.optString("matchName").ifBlank { body.optString("title") }
        val failure = host.startRecording(name)
        return if (failure == null) {
            json(JSONObject().put("ok", true))
        } else {
            errorJson(Http.BAD_REQUEST, failure)
        }
    }

    private fun apiStop(): Response {
        val failure = host.stopRecording()
        return if (failure == null) {
            json(JSONObject().put("ok", true))
        } else {
            errorJson(Http.BAD_REQUEST, failure)
        }
    }

    private fun apiSettings(session: IHTTPSession): Response {
        val body = readJsonBody(session)
        val failure = host.applySettings(body)
        return if (failure == null) {
            json(JSONObject().put("ok", true))
        } else {
            errorJson(Http.BAD_REQUEST, failure)
        }
    }

    private fun apiRetry(session: IHTTPSession): Response {
        val id = readJsonBody(session).optString("id")
        val failure = host.retryUpload(id)
        return if (failure == null) {
            json(JSONObject().put("ok", true))
        } else {
            errorJson(Http.BAD_REQUEST, failure)
        }
    }

    private fun apiDelete(session: IHTTPSession): Response {
        val body = readJsonBody(session)
        val id = body.optString("id")
        val confirmed = body.optString("confirm") == "DELETE"
        val record = store.get(id)
            ?: return errorJson(Http.NOT_FOUND, "対象が見つかりません")

        if (DeletionGuard.manualDeleteNeedsWarning(record) && !confirmed) {
            return errorJson(
                Http.BAD_REQUEST,
                DeletionGuard.manualDeleteWarningText(record),
            )
        }
        val failure = host.deleteRecord(id, confirmed)
        return if (failure == null) {
            json(JSONObject().put("ok", true))
        } else {
            errorJson(Http.BAD_REQUEST, failure)
        }
    }

    // ------------------------------------------------------------------
    // プレビュー（MJPEG）
    // ------------------------------------------------------------------

    private fun apiPreviewFrame(): Response {
        val hub = host.previewHub()
            ?: return errorJson(Http.SERVICE_UNAVAILABLE, "プレビューを利用できません")
        hub.touch()
        val frame = hub.awaitFrame(-1L, 3_000L)
            ?: return errorJson(Http.SERVICE_UNAVAILABLE, "フレームがありません")
        val res = newFixedLengthResponse(
            Http.OK,
            "image/jpeg",
            frame.jpeg.inputStream(),
            frame.jpeg.size.toLong(),
        )
        res.addHeader("Cache-Control", "no-store")
        return res
    }

    private fun apiPreviewStream(): Response {
        val hub = host.previewHub()
            ?: return errorJson(Http.SERVICE_UNAVAILABLE, "プレビューを利用できません")
        val res = newChunkedResponse(
            Http.OK,
            "multipart/x-mixed-replace; boundary=$BOUNDARY",
            MjpegStream(hub),
        )
        res.addHeader("Cache-Control", "no-store")
        res.addHeader("Connection", "close")
        return res
    }

    /** MJPEG を作りながら読み出させる InputStream。別スレッドを起こさずに済む。 */
    private class MjpegStream(private val hub: PreviewHub) : InputStream() {
        private var buffer: ByteArray = ByteArray(0)
        private var pos = 0
        private var lastSeq = -1L
        private var frames = 0

        override fun read(): Int {
            val one = ByteArray(1)
            val n = read(one, 0, 1)
            return if (n <= 0) -1 else one[0].toInt() and 0xFF
        }

        override fun read(b: ByteArray, off: Int, len: Int): Int {
            if (pos >= buffer.size) {
                hub.touch()
                // 1本のストリームが永久に居座らないよう上限を設ける（ブラウザが張り直す）
                if (frames >= MAX_FRAMES_PER_STREAM) return -1
                val frame = hub.awaitFrame(lastSeq, STREAM_TIMEOUT_MS) ?: return -1
                lastSeq = frame.seq
                frames++
                val head = (
                    "--$BOUNDARY\r\n" +
                        "Content-Type: image/jpeg\r\n" +
                        "Content-Length: ${frame.jpeg.size}\r\n\r\n"
                    ).toByteArray()
                val tail = "\r\n".toByteArray()
                buffer = ByteArray(head.size + frame.jpeg.size + tail.size)
                System.arraycopy(head, 0, buffer, 0, head.size)
                System.arraycopy(frame.jpeg, 0, buffer, head.size, frame.jpeg.size)
                System.arraycopy(tail, 0, buffer, head.size + frame.jpeg.size, tail.size)
                pos = 0
            }
            val n = minOf(len, buffer.size - pos)
            System.arraycopy(buffer, pos, b, off, n)
            pos += n
            return n
        }
    }

    // ------------------------------------------------------------------
    // 状態 JSON
    // ------------------------------------------------------------------

    fun buildStatus(): JSONObject {
        val s = AppState.current
        val rec = s.recording
        val elapsed = if (rec.state == RecState.RECORDING || rec.state == RecState.STOPPING) {
            android.os.SystemClock.elapsedRealtime() - rec.startedAtElapsedRealtime
        } else {
            0L
        }

        return JSONObject().apply {
            put(
                "device",
                JSONObject().apply {
                    put("name", s.deviceName)
                    put("model", Build.MODEL ?: "")
                    put("androidSdk", Build.VERSION.SDK_INT)
                    put("version", BuildConfig.VERSION_NAME)
                    put("build", BuildConfig.GIT_SHA)
                },
            )
            put(
                "battery",
                JSONObject().apply {
                    put("percent", s.battery.percent)
                    put("charging", s.battery.charging)
                    put("temperatureC", s.battery.temperatureC.toDouble())
                },
            )
            put(
                "storage",
                JSONObject().apply {
                    put("freeBytes", s.storage.freeBytes)
                    put("freeText", Fmt.bytes(s.storage.freeBytes))
                    put("totalBytes", s.storage.totalBytes)
                    put("recordableMinutes", s.storage.recordableMinutes)
                },
            )
            put(
                "camera",
                JSONObject().apply {
                    put("ready", s.camera.ready)
                    put("previewAvailable", s.camera.previewAvailable && prefs.previewEnabled)
                    put("quality", s.camera.quality)
                    put("bitrateMbps", s.camera.bitrateBps / 1_000_000.0)
                    put("error", s.camera.error ?: JSONObject.NULL)
                },
            )
            put(
                "recording",
                JSONObject().apply {
                    put("state", rec.state.name)
                    put("matchName", rec.matchName ?: "")
                    put("startedAtEpochMs", rec.startedAtEpochMs)
                    put("elapsedMs", elapsed)
                    put("elapsedText", Fmt.duration(elapsed))
                    put("part", rec.part)
                    put("bytesRecorded", rec.bytesRecorded)
                    put("error", rec.error ?: JSONObject.NULL)
                },
            )
            put(
                "google",
                JSONObject().apply {
                    put("signedIn", s.google.signedIn)
                    put("account", s.google.account ?: JSONObject.NULL)
                },
            )
            put(
                "settings",
                JSONObject().apply {
                    put("quality", prefs.quality)
                    put("audioEnabled", prefs.audioEnabled)
                    put("previewEnabled", prefs.previewEnabled)
                    put("splitMinutes", prefs.splitMinutes)
                    put("orientation", prefs.orientation)
                    put("wifiOnlyUpload", prefs.wifiOnlyUpload)
                },
            )
            put("uploads", uploadsJson())
            put(
                "warnings",
                JSONArray().apply {
                    s.warnings.forEach { w ->
                        put(JSONObject().put("level", w.level).put("message", w.message))
                    }
                },
            )
            put("serverTime", System.currentTimeMillis())
        }
    }

    private fun uploadsJson(): JSONArray {
        val arr = JSONArray()
        store.all()
            .sortedByDescending { it.startedAtEpochMs }
            .take(MAX_UPLOAD_ROWS)
            .forEach { r ->
                arr.put(
                    JSONObject().apply {
                        put("id", r.id)
                        put(
                            "title",
                            Fmt.buildTitle(r.startedAtEpochMs, r.matchName, r.part, r.totalParts),
                        )
                        put("state", r.state.name)
                        put("stateText", stateText(r.state))
                        put("progress", r.progress)
                        put("progressPercent", (r.progress * 100).toInt())
                        put("videoId", r.videoId ?: JSONObject.NULL)
                        put("url", r.youtubeUrl ?: JSONObject.NULL)
                        put("privacyStatus", r.privacyStatus ?: JSONObject.NULL)
                        put("sizeBytes", r.sizeBytes)
                        put("sizeText", Fmt.bytes(r.sizeBytes))
                        put("durationText", Fmt.duration(r.durationMs))
                        put("recordedAt", Fmt.dateTime(r.startedAtEpochMs))
                        put("holdsFile", r.holdsFile)
                        put("orphan", r.orphan)
                        put("needsWarningOnDelete", DeletionGuard.manualDeleteNeedsWarning(r))
                        put("error", r.lastError ?: JSONObject.NULL)
                    },
                )
            }
        return arr
    }

    private fun stateText(state: UploadState): String = when (state) {
        UploadState.PENDING_UPLOAD -> "アップロード待ち"
        UploadState.UPLOADING -> "アップロード中"
        UploadState.UPLOADED -> "確認中"
        UploadState.VERIFIED -> "確認済み（削除待ち）"
        UploadState.DONE -> "アップロード完了"
        UploadState.FAILED_PERMANENT -> "失敗（要確認）"
        UploadState.NEEDS_REVIEW -> "要確認（取り残しファイル）"
    }

    // ------------------------------------------------------------------
    // 静的ファイル
    // ------------------------------------------------------------------

    private fun serveAsset(uri: String): Response {
        val path = when {
            uri == "/" || uri.isEmpty() -> "web/index.html"
            else -> "web" + uri
        }
        // ディレクトリトラバーサル対策
        if (path.contains("..")) {
            return errorJson(Http.FORBIDDEN, "不正なパスです")
        }
        return try {
            val stream = context.assets.open(path)
            val res = newChunkedResponse(Http.OK, mimeOf(path), stream)
            res.addHeader("Cache-Control", "no-cache")
            res
        } catch (e: Exception) {
            errorJson(Http.NOT_FOUND, "ページが見つかりません")
        }
    }

    private fun mimeOf(path: String): String = when {
        path.endsWith(".html") -> "text/html; charset=utf-8"
        path.endsWith(".css") -> "text/css; charset=utf-8"
        path.endsWith(".js") -> "application/javascript; charset=utf-8"
        path.endsWith(".json") -> "application/json; charset=utf-8"
        path.endsWith(".svg") -> "image/svg+xml"
        path.endsWith(".png") -> "image/png"
        path.endsWith(".ico") -> "image/x-icon"
        else -> "application/octet-stream"
    }

    // ------------------------------------------------------------------
    // ヘルパ
    // ------------------------------------------------------------------

    private fun readJsonBody(session: IHTTPSession): JSONObject {
        return try {
            val files = HashMap<String, String>()
            session.parseBody(files)
            val raw = files["postData"]
            if (raw.isNullOrBlank()) JSONObject() else JSONObject(raw)
        } catch (e: Exception) {
            SafeLog.w(TAG, "リクエストボディを解釈できませんでした", e)
            JSONObject()
        }
    }

    private fun json(obj: JSONObject): Response {
        val res = newFixedLengthResponse(
            Http.OK,
            "application/json; charset=utf-8",
            obj.toString(),
        )
        res.addHeader("Cache-Control", "no-store")
        return res
    }

    private fun errorJson(status: Http, message: String): Response {
        val res = newFixedLengthResponse(
            status,
            "application/json; charset=utf-8",
            JSONObject().put("ok", false).put("error", message).toString(),
        )
        res.addHeader("Cache-Control", "no-store")
        return res
    }
}
