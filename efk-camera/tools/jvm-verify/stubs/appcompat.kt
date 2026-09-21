package androidx.appcompat.app
import android.app.Activity
import android.content.Context
import android.content.DialogInterface
import androidx.activity.result.ActivityResultCallback
import androidx.activity.result.ActivityResultContract
import androidx.activity.result.ActivityResultLauncher
import androidx.lifecycle.Lifecycle
import androidx.lifecycle.LifecycleOwner
class AlertDialog {
    class Builder(context: Context) {
        fun setTitle(t: CharSequence): Builder = this
        fun setMessage(m: CharSequence): Builder = this
        fun setPositiveButton(t: CharSequence, l: DialogInterface.OnClickListener?): Builder = this
        fun setNegativeButton(t: CharSequence, l: DialogInterface.OnClickListener?): Builder = this
        fun show(): AlertDialog = AlertDialog()
    }
}
open class AppCompatActivity : Activity(), LifecycleOwner {
    override val lifecycle: Lifecycle get() = throw UnsupportedOperationException()
    fun <I, O> registerForActivityResult(
        contract: ActivityResultContract<I, O>,
        callback: ActivityResultCallback<O>,
    ): ActivityResultLauncher<I> = throw UnsupportedOperationException()
}
