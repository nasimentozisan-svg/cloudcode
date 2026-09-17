package jp.efk.camera

import jp.efk.camera.server.NetworkUtils
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test

/**
 * ここが誤ると「LAN外から録画を操作される」ことになる。
 */
class NetworkUtilsTest {

    @Test
    fun `家庭やテザリングのアドレスは許可する`() {
        listOf(
            "192.168.0.1", "192.168.1.5", "192.168.255.255",
            "10.0.0.1", "10.255.255.254",
            "172.16.0.1", "172.20.10.3", "172.31.255.254",
            "169.254.1.1",
            "127.0.0.1",
            "::1",
            "::ffff:192.168.1.5",
            "fd00::1",
        ).forEach {
            assertTrue("$it は許可されるべき", NetworkUtils.isPrivateAddress(it))
        }
    }

    @Test
    fun `グローバルアドレスは拒否する`() {
        listOf(
            "8.8.8.8", "1.1.1.1", "203.0.113.5",
            "172.15.0.1", "172.32.0.1",
            "192.169.0.1", "193.168.0.1",
            "11.0.0.1",
            "2001:4860:4860::8888",
        ).forEach {
            assertFalse("$it は拒否されるべき", NetworkUtils.isPrivateAddress(it))
        }
    }

    @Test
    fun `不正な入力は拒否する`() {
        listOf(null, "", "   ", "abc", "192.168.1", "192.168.1.1.1", "999.1.1.1", "-1.0.0.1")
            .forEach {
                assertFalse("$it は拒否されるべき", NetworkUtils.isPrivateAddress(it))
            }
    }

    @Test
    fun `IPv6のゾーンIDや角括弧が付いていても判定できる`() {
        assertTrue(NetworkUtils.isPrivateAddress("[::1]"))
        assertTrue(NetworkUtils.isPrivateAddress("fe80::1%wlan0"))
    }
}
