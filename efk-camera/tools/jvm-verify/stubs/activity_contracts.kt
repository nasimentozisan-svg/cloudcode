package androidx.activity.result.contract
import android.content.Intent
import androidx.activity.result.ActivityResult
import androidx.activity.result.ActivityResultContract
object ActivityResultContracts {
    class RequestMultiplePermissions : ActivityResultContract<Array<String>, Map<String, Boolean>>()
    class StartActivityForResult : ActivityResultContract<Intent, ActivityResult>()
}
