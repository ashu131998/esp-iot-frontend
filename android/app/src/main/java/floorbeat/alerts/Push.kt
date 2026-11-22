package floorbeat.alerts

import android.content.Context
import android.os.Handler
import android.os.Looper
import com.google.firebase.FirebaseApp
import com.google.firebase.installations.FirebaseInstallations
import com.google.firebase.messaging.FirebaseMessaging

/**
 * Push on this phone: its Firebase Installation ID (FID), which the server sends alerts to (the page
 * registers it with the server on every open), the person's language (the page says it; notifications
 * are worded in it), and a pushed alert shown and passed to the open page so its inbox refreshes at once.
 */
object Push {
    private const val PREFS = "floorbeat_push"
    private const val KEY_FID = "fid"
    private const val KEY_LOCALE = "locale"

    /** What the open page hears (the bridge): a push came, the FID changed. Set while a page is open. */
    @Volatile
    var listener: ((event: String, value: String) -> Unit)? = null

    private val main = Handler(Looper.getMainLooper())

    private fun prefs(context: Context) = context.getSharedPreferences(PREFS, Context.MODE_PRIVATE)

    /** Whether this build has a Firebase project (google-services.json): without it, no push. */
    fun configured(context: Context): Boolean = FirebaseApp.getApps(context).isNotEmpty()

    fun locale(context: Context): String = prefs(context).getString(KEY_LOCALE, null) ?: "en"

    fun setLocale(context: Context, locale: String) {
        if (locale in setOf("en", "hi", "gu")) prefs(context).edit().putString(KEY_LOCALE, locale).apply()
    }

    /**
     * This phone's FID, registered with FCM ("" when push is not set up in this build). Registering is
     * repeated on every ask (FCM keeps it fresh; a registration unused for 270 days lapses).
     */
    fun installation(context: Context, done: (String) -> Unit) {
        if (!configured(context)) return done("")
        val known = prefs(context).getString(KEY_FID, null).orEmpty()
        try {
            FirebaseMessaging.getInstance().register().addOnCompleteListener {
                FirebaseInstallations.getInstance().id.addOnCompleteListener { task ->
                    val fid = if (task.isSuccessful) task.result.orEmpty() else known
                    if (fid.isNotEmpty() && fid != known) prefs(context).edit().putString(KEY_FID, fid).apply()
                    done(fid)
                }
            }
        } catch (e: Exception) {
            done(known)
        }
    }

    /** FCM registered this phone (first start, or its FID changed): kept, and the open page told (it tells the server). */
    fun registered(context: Context, fid: String) {
        prefs(context).edit().putString(KEY_FID, fid).apply()
        tell("installation", fid)
    }

    fun unregistered(context: Context, fid: String) {
        if (prefs(context).getString(KEY_FID, null) == fid) prefs(context).edit().remove(KEY_FID).apply()
    }

    /** A pushed alert: shown, and the open page told. */
    fun received(context: Context, data: Map<String, String>) {
        val message = PushMessage.from(data) ?: return
        Notifications.show(context, message, locale(context))
        tell("push", message.id)
    }

    private fun tell(event: String, value: String) {
        main.post { listener?.invoke(event, value) }
    }
}
