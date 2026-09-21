// ── AndroidX の「形」だけを再現したダミー。実 API の正しさは GitHub 上の
//    本物のソースで別途照合済み。ここで検証するのは自分のコードの整合性。
package androidx.camera.core
import android.graphics.Bitmap
import android.util.Size
import androidx.camera.core.resolutionselector.ResolutionSelector
import java.util.concurrent.Executor

abstract class UseCase
class CameraSelector { companion object { @JvmField val DEFAULT_BACK_CAMERA = CameraSelector() } }
interface ImageInfo { val rotationDegrees: Int }
interface ImageProxy : AutoCloseable {
    val imageInfo: ImageInfo
    fun toBitmap(): Bitmap
    override fun close()
}
class ImageAnalysis private constructor() : UseCase() {
    fun interface Analyzer { fun analyze(image: ImageProxy) }
    var targetRotation: Int = 0
    fun setAnalyzer(executor: Executor, analyzer: Analyzer) {}
    fun clearAnalyzer() {}
    class Builder {
        fun setResolutionSelector(s: ResolutionSelector): Builder = this
        fun setBackpressureStrategy(s: Int): Builder = this
        fun build(): ImageAnalysis = throw UnsupportedOperationException()
    }
    companion object { const val STRATEGY_KEEP_ONLY_LATEST = 0 }
}
