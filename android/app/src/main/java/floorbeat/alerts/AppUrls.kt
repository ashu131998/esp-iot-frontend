package floorbeat.alerts

import java.net.URI

/** What the back button does: back through the app's own pages, to the alerts' inbox, to the home screen, or out of the app. */
enum class Back { PAGE, INBOX, HOME, EXIT }

/**
 * The app's own addresses and what a link, a tapped notification or the back button does with one. Pure: AppUrlsTest.
 *
 * Since 3.0.0 the app is FloorBeat, one app (the owner, 2026-11-27: alerts, dashboard and stock in one): its pages are
 * dashboard.floorbeat.in, its root the home screen of apps, the alerts' screens under /inbox (the alerts app's own
 * paths behind it: /inbox/alerts/ntf-1 is the alert /alerts/ntf-1), the dashboard at /overview and the stock at /ims
 * (the web app's src/lib/dashboard-app.ts). Links to the alerts' old address, alerts.floorbeat.in, open their page here.
 */
object AppUrls {
    private val ALERT_ID = Regex("^[A-Za-z0-9_-]{1,100}$")

    /** The alerts' screens inside the app. */
    const val INBOX = "/inbox"

    /** The alerts' own address up to 2.0.0: its links (in messages and emails already sent) open their page in the app. */
    const val OLD_ALERTS_URL = "https://alerts.floorbeat.in"

    private fun parse(url: String?): URI? =
        if (url.isNullOrBlank()) null else try { URI(url.trim()) } catch (e: Exception) { null }

    /** "https://dashboard.floorbeat.in" for any address there (the port only when it is not the scheme's own); null for anything else. */
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

    /** One of the app's own pages: shown in the app. Any other address opens outside it (the phone's browser, the dialler, mail). */
    fun isAppPage(url: String?, appUrl: String): Boolean {
        val origin = origin(url)
        return origin != null && origin == origin(appUrl)
    }

    /** The path of an address ("/inbox/alerts/ntf-1"), "/" when it has none. */
    fun pathOf(url: String?): String {
        val path = parse(url)?.rawPath
        return if (path.isNullOrEmpty()) "/" else path
    }

    /** The home screen of apps: the app's "/". */
    fun isHome(url: String?, appUrl: String): Boolean =
        isAppPage(url, appUrl) && pathOf(url).trimEnd('/') == ""

    /** The alerts' inbox: the app's /inbox (or /inbox/alerts, the alerts app's old inbox address). */
    fun isInbox(url: String?, appUrl: String): Boolean {
        if (!isAppPage(url, appUrl)) return false
        val path = pathOf(url).trimEnd('/')
        return path == INBOX || path == "$INBOX/alerts"
    }

    /** One of the alerts' other pages (an alert, the alerts' settings). */
    private fun isAlertsPage(url: String?, appUrl: String): Boolean =
        isAppPage(url, appUrl) && pathOf(url).startsWith("$INBOX/") && !isInbox(url, appUrl)

    /** A page of the app given as a path ("/inbox/alerts/ntf-1"): one leading slash, never another site ("//x", "/\x"). */
    fun appPath(path: String?): String? {
        if (path.isNullOrEmpty() || !path.startsWith("/") || path.startsWith("//")) return null
        if (path.any { it == '\\' || it.code < 0x20 }) return null
        return path
    }

    /** The alerts app's page of an alert ("/alerts/ntf-1"), for a well-formed id (the server's ids) only. */
    fun alertPath(id: String?): String? = if (id != null && ALERT_ID.matches(id)) "/alerts/$id" else null

    /**
     * One of the alerts app's pages ("/alerts/ntf-1", as the server and the alerts' screens name them; "/" its inbox)
     * at its place in the app: "/inbox/alerts/ntf-1", "/inbox". A path already in the inbox is kept as it is.
     */
    fun inboxPath(path: String): String = when {
        path == INBOX || path.startsWith("$INBOX/") -> path
        path == "/" || path.isEmpty() -> INBOX
        else -> INBOX + path
    }

    /** Where a pushed alert's tap goes: its page as the server named it, else its id's page, else the inbox; in the app's inbox. */
    fun tapPath(url: String?, id: String?): String = inboxPath(appPath(url) ?: alertPath(id) ?: "/")

    /** The full address of a page of the app. */
    fun pageUrl(appUrl: String, path: String): String = appUrl.trimEnd('/') + (appPath(path) ?: "/")

    /**
     * The page a link opens in the app: one of the app's own as it is; one at the alerts' old address
     * (https://alerts.floorbeat.in/alerts/ntf-1) at its place in the inbox (…/inbox/alerts/ntf-1, its query kept);
     * null for any other address (it opens outside the app).
     */
    fun linkPage(url: String?, appUrl: String): String? {
        if (isAppPage(url, appUrl)) return url!!.trim()
        if (!isAppPage(url, OLD_ALERTS_URL)) return null
        val query = parse(url)?.rawQuery?.let { "?$it" } ?: ""
        return pageUrl(appUrl, inboxPath(appPath(pathOf(url)) ?: "/")) + query
    }

    /**
     * The back button. Back through the app's pages while there are any; with nothing behind, an alert (opened
     * straight from a notification) goes to the inbox, any other page to the home screen; on the home screen, or
     * before signing in, the app goes to the background (as every Android app's first screen does).
     */
    fun back(canGoBack: Boolean, currentUrl: String?, appUrl: String): Back = when {
        canGoBack -> Back.PAGE
        !isAppPage(currentUrl, appUrl) || isHome(currentUrl, appUrl) -> Back.EXIT
        isAlertsPage(currentUrl, appUrl) -> Back.INBOX
        else -> Back.HOME
    }
}
