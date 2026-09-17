package jp.efk.camera.auth

import android.accounts.Account
import android.accounts.AccountManager
import android.content.Context
import android.content.Intent
import com.google.android.gms.auth.GoogleAuthException
import com.google.android.gms.auth.GoogleAuthUtil
import com.google.android.gms.auth.UserRecoverableAuthException
import jp.efk.camera.core.AppState
import jp.efk.camera.core.GoogleInfo
import jp.efk.camera.core.Prefs
import jp.efk.camera.util.Redactor
import jp.efk.camera.util.SafeLog
import java.io.IOException

/**
 * Google 認証。
 *
 * ★ アプリはパスワードもリフレッシュトークンも保持しない（設計書 5.1）。
 *   Play 開発者サービスがアクセストークンを都度発行し、自動更新する。
 *   アプリが持つのは「どのアカウントを使うか」という名前だけ。
 */
class GoogleAuthManager(private val context: Context) {

    private val prefs = Prefs.get(context)

    /** 直近で「同意画面を出してほしい」と言われたときの復帰用 Intent。 */
    @Volatile
    var pendingRecoveryIntent: Intent? = null
        private set

    val accountName: String? get() = prefs.googleAccount

    /** アカウント選択画面を出す Intent。 */
    fun chooseAccountIntent(): Intent =
        AccountManager.newChooseAccountIntent(
            selectedAccount(),
            null,
            arrayOf(ACCOUNT_TYPE),
            null,
            null,
            null,
            null,
        )

    fun setAccount(name: String?) {
        prefs.googleAccount = name
        pendingRecoveryIntent = null
        publish()
    }

    fun signOut() {
        prefs.googleAccount = null
        pendingRecoveryIntent = null
        publish()
    }

    fun publish() {
        val name = prefs.googleAccount
        AppState.update {
            it.copy(google = GoogleInfo(signedIn = !name.isNullOrBlank(), account = name))
        }
    }

    private fun selectedAccount(): Account? =
        prefs.googleAccount?.takeIf { it.isNotBlank() }?.let { Account(it, ACCOUNT_TYPE) }

    /**
     * アクセストークンを取得する。**ネットワークを使うので必ずワーカースレッドから呼ぶこと。**
     *
     * @throws AuthNotReady 同意が必要 / アカウント未選択など、人の操作が要る場合
     * @throws IOException 一時的な失敗（再試行してよい）
     */
    @Throws(AuthNotReady::class, IOException::class)
    fun accessTokenBlocking(): String {
        val account = selectedAccount()
            ?: throw AuthNotReady("Google アカウントが選択されていません")
        return try {
            GoogleAuthUtil.getToken(context, account, SCOPE_STRING)
        } catch (e: UserRecoverableAuthException) {
            pendingRecoveryIntent = e.intent
            SafeLog.w(TAG, "Google の同意操作が必要です")
            throw AuthNotReady("KYV47 本体で Google の許可操作が必要です")
        } catch (e: GoogleAuthException) {
            SafeLog.e(TAG, "Google 認証に失敗しました", e)
            throw AuthNotReady("Google 認証に失敗しました: ${Redactor.redact(e.message)}")
        }
    }

    /** 401 を受けたときに呼ぶ。次回は新しいトークンが発行される。 */
    fun invalidate(token: String) {
        try {
            GoogleAuthUtil.clearToken(context, token)
        } catch (e: Exception) {
            SafeLog.w(TAG, "トークンの破棄に失敗しました", e)
        }
    }

    fun clearRecoveryIntent() {
        pendingRecoveryIntent = null
    }

    class AuthNotReady(message: String) : Exception(message)

    companion object {
        private const val TAG = "GoogleAuth"
        private const val ACCOUNT_TYPE = "com.google"

        /** アップロードと、削除前の存在確認に必要な最小限のスコープ。 */
        const val SCOPE_UPLOAD = "https://www.googleapis.com/auth/youtube.upload"
        const val SCOPE_READONLY = "https://www.googleapis.com/auth/youtube.readonly"
        const val SCOPE_STRING = "oauth2:$SCOPE_UPLOAD $SCOPE_READONLY"
    }
}
