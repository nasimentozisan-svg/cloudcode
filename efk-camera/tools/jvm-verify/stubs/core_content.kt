package androidx.core.content
import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.content.IntentFilter
import java.util.concurrent.Executor
object ContextCompat {
    const val RECEIVER_NOT_EXPORTED = 0x4
    const val RECEIVER_EXPORTED = 0x2
    @JvmStatic fun checkSelfPermission(context: Context, permission: String): Int = 0
    @JvmStatic fun getMainExecutor(context: Context): Executor = throw UnsupportedOperationException()
    @JvmStatic fun registerReceiver(context: Context, receiver: BroadcastReceiver?, filter: IntentFilter, flags: Int): Intent? = null
}
