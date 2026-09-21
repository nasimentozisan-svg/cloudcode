package androidx.activity.result
import android.app.Activity
import android.content.Intent
class ActivityResult { val data: Intent? = null; val resultCode: Int = 0 }
interface ActivityResultLauncher<I> { fun launch(input: I) }
fun interface ActivityResultCallback<O> { fun onActivityResult(result: O) }
abstract class ActivityResultContract<I, O>
