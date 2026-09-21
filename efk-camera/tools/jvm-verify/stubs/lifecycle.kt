package androidx.lifecycle
import android.app.Service
import android.content.Intent
import android.os.IBinder
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlin.coroutines.EmptyCoroutineContext

abstract class Lifecycle { enum class State { DESTROYED, INITIALIZED, CREATED, STARTED, RESUMED } }
interface LifecycleOwner { val lifecycle: Lifecycle }
open class LifecycleService : Service(), LifecycleOwner {
    override val lifecycle: Lifecycle get() = throw UnsupportedOperationException()
    override fun onCreate() {}
    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int = 0
    override fun onBind(intent: Intent): IBinder? = null
    override fun onDestroy() {}
}
val LifecycleOwner.lifecycleScope: CoroutineScope get() = throw UnsupportedOperationException()
suspend fun LifecycleOwner.repeatOnLifecycle(state: Lifecycle.State, block: suspend CoroutineScope.() -> Unit) {}
