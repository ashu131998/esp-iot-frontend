package floorbeat.alerts

import android.webkit.WebViewClient

/**
 * When a page's load failing means the phone is off the network (the offline screen), and how often the app
 * tries again by itself (the owner, 2026-11-27: "im getting this even when im online"). Before 3.0.1 any
 * failed load of a page showed the screen, a load cancelled for the next one too (net::ERR_ABORTED, reported
 * after the next page had started), and the screen stayed until "Try again" was pressed, whatever the network
 * did meanwhile. Pure: Offline.kt's rules, MainActivity's wiring (OfflineTest).
 */
object Offline {
    /**
     * The network's failures: no name, no answer, a refused or dropped connection, a handshake cut short. Not
     * one: a load cancelled for another (ERR_ABORTED), a page from the cache that is not there (ERR_CACHE_MISS),
     * a response a policy blocked, an address or a scheme the web view does not load.
     */
    fun isNetworkFailure(errorCode: Int, description: String?): Boolean {
        val d = description.orEmpty()
        if (NOT_NETWORK.any { it in d }) return false
        return when (errorCode) {
            WebViewClient.ERROR_HOST_LOOKUP,
            WebViewClient.ERROR_CONNECT,
            WebViewClient.ERROR_TIMEOUT,
            WebViewClient.ERROR_IO,
            WebViewClient.ERROR_FAILED_SSL_HANDSHAKE,
            WebViewClient.ERROR_PROXY_AUTHENTICATION -> true
            WebViewClient.ERROR_UNKNOWN -> NETWORK.any { it in d }
            else -> false
        }
    }

    private val NOT_NETWORK = listOf("ERR_ABORTED", "ERR_CACHE_MISS", "ERR_BLOCKED")
    private val NETWORK = listOf(
        "ERR_INTERNET_DISCONNECTED", "ERR_NAME_NOT_RESOLVED", "ERR_NAME_RESOLUTION_FAILED", "ERR_CONNECTION",
        "ERR_NETWORK", "ERR_TIMED_OUT", "ERR_ADDRESS_UNREACHABLE", "ERR_PROXY", "ERR_EMPTY_RESPONSE",
    )

    /** The wait before the n-th try again by itself (0 = the first): 2 s, 4 s, 8 s, 16 s, then every 30 s while the screen shows. */
    fun retryDelayMs(attempt: Int): Long = minOf(30_000L, 2_000L shl attempt.coerceIn(0, 4))
}
