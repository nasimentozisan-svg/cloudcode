package jp.efk.camera.core

/**
 * 発熱時にプレビュー生成を止めるためのフラグ。
 *
 * ★ 録画そのものは絶対に止めない（設計書 6.4）。
 *   「試合が録れていない」損失のほうが圧倒的に大きいため、警告だけ出して
 *   負荷の軽い側（プレビュー）を落とす。
 */
object ThermalGuard {

    /** 警告を出し始める電池温度。 */
    const val WARN_C = 40.0f

    /** 強い警告を出す電池温度。 */
    const val HOT_C = 45.0f

    @Volatile
    var previewBlocked: Boolean = false
        private set

    fun onTemperature(celsius: Float) {
        // 一度止めたら 38℃ を下回るまで戻さない（境界でばたつかせない）
        previewBlocked = when {
            celsius >= WARN_C -> true
            celsius in 0.1f..38.0f -> false
            else -> previewBlocked
        }
    }

    fun reset() {
        previewBlocked = false
    }
}
