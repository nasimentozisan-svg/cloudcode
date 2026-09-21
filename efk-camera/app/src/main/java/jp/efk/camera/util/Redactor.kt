package jp.efk.camera.util

/**
 * ログ・エラーメッセージから秘密情報を取り除く。
 *
 * 純粋関数だけを置き、Android に依存させない（= CI の Unit Test で必ず検証される）。
 * アプリ内では [SafeLog] 経由でのみ使う。
 */
object Redactor {

    private val PATTERNS: List<Pair<Regex, String>> = listOf(
        // OAuth アクセストークン（ya29.… / 1//0… など）
        Regex("""ya29\.[A-Za-z0-9_\-.]+""") to "ya29.***",
        Regex("""1//[A-Za-z0-9_\-]{10,}""") to "1//***",
        // Authorization ヘッダ
        Regex("""(?i)(bearer)\s+[A-Za-z0-9_\-.~+/]+=*""") to "$1 ***",
        // Google API キー
        Regex("""AIza[A-Za-z0-9_\-]{10,}""") to "AIza***",
        // 再開可能アップロードURL（upload_id を持つ = これ自体が認可の代わりになる）
        Regex("""(?i)([?&]upload_id=)[A-Za-z0-9_\-.]+""") to "$1***",
        // 秘密鍵
        Regex("""-----BEGIN [A-Z ]*PRIVATE KEY-----[\s\S]*?-----END [A-Z ]*PRIVATE KEY-----""")
            to "-----BEGIN PRIVATE KEY----- *** -----END PRIVATE KEY-----",
        // ペアリングトークン（本アプリの形式）
        Regex("""efk_[A-Za-z0-9_\-]{8,}""") to "efk_***",
    )

    /** 任意の文字列から秘密情報を落とす。 */
    fun redact(message: String?): String {
        val input = message ?: return ""
        if (input.isEmpty()) return ""
        var out: String = input
        for ((re, replacement) in PATTERNS) {
            out = re.replace(out, replacement)
        }
        return out
    }

    /** 6桁PINなど、固定長の数字列を伏せる。 */
    fun redactPin(pin: String?): String = if (pin.isNullOrEmpty()) "" else "*".repeat(pin.length)

    /** メールアドレスを部分マスクする（どのアカウントかは分かるが、全体は出さない）。 */
    fun maskEmail(email: String?): String {
        if (email.isNullOrEmpty()) return ""
        val at = email.indexOf('@')
        if (at <= 0) return "***"
        val local = email.substring(0, at)
        val domain = email.substring(at)
        val head = local.take(3)
        return "$head***$domain"
    }
}
