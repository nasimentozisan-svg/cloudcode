package androidx.camera.lifecycle
import android.content.Context
import androidx.camera.core.CameraSelector
import androidx.camera.core.UseCase
import androidx.lifecycle.LifecycleOwner
import com.google.common.util.concurrent.ListenableFuture
class ProcessCameraProvider private constructor() {
    fun unbindAll() {}
    fun bindToLifecycle(owner: LifecycleOwner, selector: CameraSelector, vararg useCases: UseCase): Any = Any()
    companion object {
        @JvmStatic fun getInstance(context: Context): ListenableFuture<ProcessCameraProvider> = throw UnsupportedOperationException()
    }
}
