package floorbeat.alerts

import java.net.URI

/** What the back button does: back through the app's own pages, to the inbox, or out of the app. */
enum class Back { PAGE, INBOX, EXIT }

/**
 * The app's own addresses (alerts.floorbeat.in) and what a link, a tapped notification or the back
 * button does with one. Pure: AppUrlsTest.
 */
object AppUrls {
    private val ALERT_ID = Regex("^[A-Za-z0-9_-]{1,100}$")

    private fun parse(url: String?): URI? =
        if (url.isNullOrBlank()) null else try { URI(url.trim()) } catch (e: Exception) { null }

    /** "https://alerts.floorbeat.in" for any address there (the port only when it is not the scheme's own); null for anything else. */
    fun origin(url: String?): String? {
        val uri = parse(url) ?: return null
        val scheme = uri.scheme?.lowercase() ?: return null
        val host = uri.host?.lowercase() ?: return null
        if (scheme != "https" && scheme != "http") return null
        val port = when {
            uri.port == -1 -> ""
            scheme == "https" && uri.port == 443 -> ""
            scheme == "http" && uri.port == 80 -> ""
            else -> ":${uri.port}"
        }
        return "$scheme://$host$port"
    }

    /** One of the app's own pages: shown in the app. Any other address opens outside it (the phone's browser). */
    fun isAppPage(url: String?, appUrl: String): Boolean {
        val origin = origin(url)
        return origin != null && origin == origin(appUrl)
    }

    /** The path of an address ("/alerts/ntf-1"), "/" when it has none. */
    fun pathOf(url: String?): String {
        val path = parse(url)?.rawPath
        return if (path.isNullOrEmpty()) "/" else path
    }

    /** The inbox: the app's "/" (or its old "/alerts"). */
    fun isInbox(url: String?, appUrl: String): Boolean {
        if (!isAppPage(url, appUrl)) return false
        val path = pathOf(url).trimEnd('/')
        return path == "" || path == "/alerts"
    }

    /** A page of the app given as a path ("/alerts/ntf-1"): one leading slash, never another site ("//x", "/\x"). */
    fun appPath(path: String?): String? {
        if (path.isNullOrEmpty() || !path.startsWith("/") || path.startsWith("//")) return null
        if (path.any { it == '\\' || it.code < 0x20 }) return null
        return path
    }

    /** The page of an alert, for a well-formed id (the server's ids) only. */
    fun alertPath(id: String?): String? = if (id != null && ALERT_ID.matches(id)) "/alerts/$id" else null

    /** Where a pushed alert's tap goes: its page as the server named it, else its id's page, else the inbox. */
    fun tapPath(url: String?, id: String?): String = appPath(url) ?: alertPath(id) ?: "/"

    /** The full address of a page of the app. */
    fun pageUrl(appUrl: String, path: String): String = appUrl.trimEnd('/') + (appPath(path) ?: "/")

    /**
     * The back button. Back through the app's own pages while there are any; an alert opened straight
     * from a notification (nothing behind it) goes to the inbox; on the inbox, or before signing in,
     * the app closes (as every Android app's first screen does).
     */
    fun back(canGoBack: Boolean, currentUrl: String?, appUrl: String): Back = when {
        canGoBack -> Back.PAGE
        isAppPage(currentUrl, appUrl) && !isInbox(currentUrl, appUrl) -> Back.INBOX
        else -> Back.EXIT
    }
}
