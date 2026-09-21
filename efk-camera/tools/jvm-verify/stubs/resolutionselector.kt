package androidx.camera.core.resolutionselector
import android.util.Size
class ResolutionStrategy(boundSize: Size, fallbackRule: Int) {
    companion object { const val FALLBACK_RULE_CLOSEST_LOWER_THEN_HIGHER = 3 }
}
class ResolutionSelector private constructor() {
    class Builder {
        fun setResolutionStrategy(s: ResolutionStrategy): Builder = this
        fun build(): ResolutionSelector = throw UnsupportedOperationException()
    }
}
