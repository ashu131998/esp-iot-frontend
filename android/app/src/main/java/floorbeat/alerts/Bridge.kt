package floorbeat.alerts

import android.net.Uri
import android.webkit.WebView
import androidx.webkit.JavaScriptReplyProxy
import androidx.webkit.WebMessageCompat
import androidx.webkit.WebViewCompat
import org.json.JSONObject

/**
 * What the app's pages ask the app (src/lib/alerts-app/native.ts in the web app): window.FloorBeatAndroid,
 * given only to the app's own origin (WebViewCompat.addWebMessageListener). A page sends
 * {"id": 1, "call": "notifications"} and gets {"id": 1, "result": {...}} back; the app also tells the
 * open page {"event": "push" | "installation" | "notifications", "value": "..."}.
 *
 * Calls: hello (the app, the phone, notifications, battery, all at once), notifications,
 * askNotifications, openNotificationSettings, installation (this phone's FID for push), setLanguage
 * {locale}, openBatterySettings, openAutostartSettings.
 */
class Bridge(private val activity: MainActivity) : WebViewCompat.WebMessageListener {
    private var page: JavaScriptReplyProxy? = null

    override fun onPostMessage(view: WebView, message: WebMessageCompat, sourceOrigin: Uri, isMainFrame: Boolean, replyProxy: JavaScriptReplyProxy) {
        if (!isMainFrame) return
        page = replyProxy
        val request = try { JSONObject(message.data ?: return) } catch (e: Exception) { return }
        val id = request.optInt("id", -1)
        val reply = { result: JSONObject -> send(replyProxy, JSONObject().put("id", id).put("result", result)) }
        when (request.optString("call")) {
            "hello" -> reply(activity.hello())
            "notifications" -> reply(JSONObject().put("state", activity.notificationsState()))
            "askNotifications" -> activity.askNotifications { state -> reply(JSONObject().put("state", state)) }
            "openNotificationSettings" -> reply(JSONObject().put("ok", activity.openNotificationSettings()))
            "installation" -> Push.installation(activity.applicationContext) { fid -> reply(JSONObject().put("fid", fid)) }
            "setLanguage" -> {
                Push.setLocale(activity.applicationContext, request.optString("locale"))
                reply(JSONObject().put("ok", true))
            }
            "openBatterySettings" -> reply(JSONObject().put("ok", activity.openBatterySettings()))
            "openAutostartSettings" -> reply(JSONObject().put("ok", activity.openAutostartSettings()))
            else -> reply(JSONObject().put("error", "unknown call"))
        }
    }

    /** Tells the open page something happened (a push came, the token changed, notifications switched). */
    fun event(name: String, value: String) {
        page?.let { send(it, JSONObject().put("event", name).put("value", value)) }
    }

    private fun send(proxy: JavaScriptReplyProxy, json: JSONObject) {
        try {
            proxy.postMessage(json.toString())
        } catch (e: Exception) {
            // the page has gone (a reload, a new page): it asks again when it starts
        }
    }
}
