package jp.efk.camera.core

import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.update

enum class RecState {
    IDLE,
    STARTING,
    RECORDING,
    STOPPING,
    ERROR,
}

data class BatteryInfo(
    val percent: Int = -1,
    val charging: Boolean = false,
    val temperatureC: Float = 0f,
)

data class StorageInfo(
    val freeBytes: Long = 0L,
    val totalBytes: Long = 0L,
    val recordableMinutes: Int = 0,
)

data class CameraInfo(
    val ready: Boolean = false,
    val previewAvailable: Boolean = false,
    val quality: String = Prefs.Q_FHD,
    val bitrateBps: Int = Prefs.DEFAULT_BITRATE_FHD,
    val error: String? = null,
)

data class RecordingInfo(
    val state: RecState = RecState.IDLE,
    val sessionId: String? = null,
    val matchName: String? = null,
    /** タイトルの日付に使う実時刻。 */
    val startedAtEpochMs: Long = 0L,
    /** 経過時間の計算に使う単調増加時刻（時計合わせの影響を受けない）。 */
    val startedAtElapsedRealtime: Long = 0L,
    val part: Int = 1,
    val bytesRecorded: Long = 0L,
    val error: String? = null,
)

data class GoogleInfo(
    val signedIn: Boolean = false,
    val account: String? = null,
)

data class Warning(
    val level: String,
    val message: String,
) {
    companion object {
        const val INFO = "info"
        const val WARN = "warn"
        const val ERROR = "error"
    }
}

data class Status(
    val deviceName: String = "CAMERA",
    val model: String = "",
    val sdkInt: Int = 0,
    val versionName: String = "",
    val gitSha: String = "",
    val serverRunning: Boolean = false,
    val serverPort: Int = Prefs.DEFAULT_PORT,
    val serverUrls: List<String> = emptyList(),
    val battery: BatteryInfo = BatteryInfo(),
    val storage: StorageInfo = StorageInfo(),
    val camera: CameraInfo = CameraInfo(),
    val recording: RecordingInfo = RecordingInfo(),
    val google: GoogleInfo = GoogleInfo(),
    val warnings: List<Warning> = emptyList(),
)

/**
 * アプリ全体で唯一の状態保持者。
 *
 * ★ 設計上の約束
 *   - 書き込むのは EfkCameraService だけ
 *   - MainActivity（本体画面）も ControlServer（ブラウザ）も読むだけ
 *   - 操作端末の接続状態はここに一切影響しない
 *     → 「操作端末が切れても録画が止まらない」を構造で保証する（設計書 8.2）
 */
object AppState {

    private val _status = MutableStateFlow(Status())
    val status: StateFlow<Status> = _status.asStateFlow()

    val current: Status get() = _status.value

    fun update(block: (Status) -> Status) {
        _status.update(block)
    }

    val isRecording: Boolean
        get() = _status.value.recording.state.let {
            it == RecState.RECORDING || it == RecState.STARTING || it == RecState.STOPPING
        }
}
