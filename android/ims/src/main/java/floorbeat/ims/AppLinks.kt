package floorbeat.ims

import java.net.URI

/** What the back button does: back through the app's own pages, or out of the app. */
enum class Back { PAGE, EXIT }

/**
 * The app's own addresses (ims.floorbeat.in) and what a link or the back button does with one.
 * Pure: AppLinksTest.
 */
object AppLinks {
    private fun parse(url: String?): URI? =
        if (url.isNullOrBlank()) null else try { URI(url.trim()) } catch (e: Exception) { null }

    /** "https://ims.floorbeat.in" for any address there (the port only when it is not the scheme's own); null for anything else. */
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

    /** The app's first page. */
    fun home(appUrl: String): String = appUrl.trimEnd('/') + "/"

    /** Where the app starts: the page of the link it was opened with when that is one of its own, else its first page. */
    fun startUrl(link: String?, appUrl: String): String =
        if (link != null && isAppPage(link, appUrl)) link.trim() else home(appUrl)

    /** The back button: back through the app's pages while there are any; on the first one the app goes to the background. */
    fun back(canGoBack: Boolean): Back = if (canGoBack) Back.PAGE else Back.EXIT
}
