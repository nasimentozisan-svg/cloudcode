package androidx.camera.video
import android.content.Context
import androidx.camera.core.UseCase
import androidx.core.util.Consumer
import java.io.File
import java.util.concurrent.Executor

enum class Quality { SD, HD, FHD, UHD }
class FallbackStrategy { companion object { @JvmStatic fun lowerQualityOrHigherThan(q: Quality): FallbackStrategy = FallbackStrategy() } }
class QualitySelector private constructor() {
    companion object { @JvmStatic fun from(q: Quality, f: FallbackStrategy): QualitySelector = QualitySelector() }
}
class FileOutputOptions private constructor() {
    class Builder(file: File) {
        fun setFileSizeLimit(bytes: Long): Builder = this
        fun setDurationLimitMillis(ms: Long): Builder = this
        fun build(): FileOutputOptions = throw UnsupportedOperationException()
    }
}
class RecordingStats { val numBytesRecorded: Long = 0L; val recordedDurationNanos: Long = 0L }
class OutputResults { val outputUri: android.net.Uri? = null }
abstract class VideoRecordEvent {
    val recordingStats: RecordingStats = RecordingStats()
    class Start : VideoRecordEvent()
    class Status : VideoRecordEvent()
    class Pause : VideoRecordEvent()
    class Resume : VideoRecordEvent()
    class Finalize : VideoRecordEvent() {
        val error: Int = 0
        val outputResults: OutputResults = OutputResults()
        fun hasError(): Boolean = false
        companion object {
            const val ERROR_NONE = 0
            const val ERROR_FILE_SIZE_LIMIT_REACHED = 2
            const val ERROR_INSUFFICIENT_STORAGE = 3
            const val ERROR_SOURCE_INACTIVE = 4
            const val ERROR_INVALID_OUTPUT_OPTIONS = 5
            const val ERROR_ENCODING_FAILED = 6
            const val ERROR_RECORDER_ERROR = 7
            const val ERROR_NO_VALID_DATA = 8
            const val ERROR_DURATION_LIMIT_REACHED = 9
            const val ERROR_RECORDING_GARBAGE_COLLECTED = 10
        }
    }
}
class Recording { fun stop() {}; fun pause() {}; fun resume() {} }
class PendingRecording {
    fun withAudioEnabled(): PendingRecording = this
    fun start(listenerExecutor: Executor, listener: Consumer<VideoRecordEvent>): Recording = Recording()
}
class Recorder private constructor() {
    fun prepareRecording(context: Context, options: FileOutputOptions): PendingRecording = PendingRecording()
    class Builder {
        fun setQualitySelector(q: QualitySelector): Builder = this
        fun setTargetVideoEncodingBitRate(bitrate: Int): Builder = this
        fun setExecutor(e: Executor): Builder = this
        fun build(): Recorder = throw UnsupportedOperationException()
    }
}
class VideoCapture<T> private constructor() : UseCase() {
    var targetRotation: Int = 0
    val output: T get() = throw UnsupportedOperationException()
    companion object { @JvmStatic fun withOutput(recorder: Recorder): VideoCapture<Recorder> = throw UnsupportedOperationException() }
}
