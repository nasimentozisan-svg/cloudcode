package jp.efk.camera.server

import java.net.Inet4Address
import java.net.NetworkInterface

object NetworkUtils {

    /**
     * 同一LAN（プライベートアドレス）からの接続かどうか。
     *
     * 純粋関数にして CI の Unit Test で検証する。
     * ここが誤ると「外部から録画操作される」ことになるため、最も慎重に扱う。
     */
    fun isPrivateAddress(ip: String?): Boolean {
        if (ip.isNullOrBlank()) return false
        var host = ip.trim()

        // IPv6 表記の揺れを吸収する
        if (host.startsWith("[") && host.endsWith("]")) host = host.substring(1, host.length - 1)
        val pct = host.indexOf('%')
        if (pct > 0) host = host.substring(0, pct)

        // IPv6 のループバック
        if (host == "::1" || host == "0:0:0:0:0:0:0:1") return true
        // IPv4-mapped IPv6 (::ffff:192.168.1.5)
        if (host.startsWith("::ffff:", ignoreCase = true)) host = host.substring(7)
        // ユニークローカルアドレス fc00::/7
        if (host.contains(':')) {
            val head = host.substringBefore(':').lowercase()
            if (head.length >= 2) {
                val prefix = head.take(2)
                if (prefix == "fc" || prefix == "fd") return true
                if (head.take(3) == "fe8") return true // リンクローカル
            }
            return false
        }

        val parts = host.split('.')
        if (parts.size != 4) return false
        val n = parts.map { it.toIntOrNull() ?: return false }
        if (n.any { it < 0 || it > 255 }) return false

        return when {
            n[0] == 127 -> true                                  // ループバック
            n[0] == 10 -> true                                   // 10.0.0.0/8
            n[0] == 192 && n[1] == 168 -> true                   // 192.168.0.0/16
            n[0] == 172 && n[1] in 16..31 -> true                // 172.16.0.0/12
            n[0] == 169 && n[1] == 254 -> true                   // リンクローカル
            else -> false
        }
    }

    /** この端末が持っている LAN 側 IPv4 アドレス。操作端末に見せる用。 */
    fun localIpv4Addresses(): List<String> = try {
        NetworkInterface.getNetworkInterfaces()
            .toList()
            .filter { runCatching { it.isUp && !it.isLoopback }.getOrDefault(false) }
            .flatMap { nif ->
                nif.inetAddresses.toList()
                    .filterIsInstance<Inet4Address>()
                    .mapNotNull { it.hostAddress }
            }
            .filter { isPrivateAddress(it) && !it.startsWith("127.") }
            .distinct()
    } catch (e: Exception) {
        emptyList()
    }
}
