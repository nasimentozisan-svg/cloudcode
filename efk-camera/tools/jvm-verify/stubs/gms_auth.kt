package com.google.android.gms.auth
import android.accounts.Account
import android.content.Context
import android.content.Intent
open class GoogleAuthException(message: String?) : Exception(message)
class UserRecoverableAuthException(message: String?, val intent: Intent) : GoogleAuthException(message)
object GoogleAuthUtil {
    @JvmStatic fun getToken(context: Context, account: Account, scope: String): String = ""
    @JvmStatic fun clearToken(context: Context, token: String) {}
}
