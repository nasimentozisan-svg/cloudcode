package jp.efk.camera

import jp.efk.camera.util.Redactor
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test

/**
 * ログ・エラー出力に Secrets が残らないことを保証する（追加ご指示への対応）。
 */
class RedactorTest {

    @Test
    fun `アクセストークンを落とす`() {
        val secret = "ya29.a0AfB_byC-SUPER_SECRET_TOKEN_VALUE123"
        val out = Redactor.redact("token=$secret")
        assertFalse(out.contains("SUPER_SECRET"))
        assertTrue(out.contains("ya29.***"))
    }

    @Test
    fun `Authorizationヘッダを落とす`() {
        val out = Redactor.redact("Authorization: Bearer abcDEF123456.-_~+/=")
        assertFalse(out.contains("abcDEF123456"))
        assertTrue(out.contains("***"))
    }

    @Test
    fun `アップロードURLのupload_idを落とす`() {
        val url = "https://www.googleapis.com/upload/youtube/v3/videos?uploadType=resumable" +
            "&upload_id=AEnB2UoSECRETUPLOADID"
        val out = Redactor.redact(url)
        assertFalse(out.contains("AEnB2UoSECRETUPLOADID"))
        assertTrue(out.contains("upload_id=***"))
    }

    @Test
    fun `APIキーを落とす`() {
        val out = Redactor.redact("key=AIzaSyA-SECRETAPIKEY-1234567890")
        assertFalse(out.contains("SECRETAPIKEY"))
    }

    @Test
    fun `リフレッシュトークンを落とす`() {
        val out = Redactor.redact("refresh=1//0gSECRETREFRESHTOKEN")
        assertFalse(out.contains("SECRETREFRESHTOKEN"))
    }

    @Test
    fun `ペアリングトークンを落とす`() {
        val out = Redactor.redact("cookie efk_0123456789abcdef を受信")
        assertFalse(out.contains("0123456789abcdef"))
        assertTrue(out.contains("efk_***"))
    }

    @Test
    fun `秘密鍵を落とす`() {
        val pem = "-----BEGIN PRIVATE KEY-----\nMIIEvQIBADAN\n-----END PRIVATE KEY-----"
        val out = Redactor.redact(pem)
        assertFalse(out.contains("MIIEvQIBADAN"))
    }

    @Test
    fun `PINは長さだけ残す`() {
        assertEquals("******", Redactor.redactPin("123456"))
        assertEquals("", Redactor.redactPin(null))
    }

    @Test
    fun `メールアドレスは部分マスクする`() {
        assertEquals("emf***@gmail.com", Redactor.maskEmail("emfrentekumamoto@gmail.com"))
        assertEquals("***", Redactor.maskEmail("@broken"))
        assertEquals("", Redactor.maskEmail(null))
    }

    @Test
    fun `普通の文章は変えない`() {
        val text = "録画を開始しました part=1"
        assertEquals(text, Redactor.redact(text))
    }
}
