package floorbeat.alerts

import android.webkit.WebViewClient
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test

/** The offline screen shows for the network's failures only, and the app tries again by itself, sooner first. */
class OfflineTest {
    @Test
    fun theNetworksFailuresShowTheScreen() {
        assertTrue(Offline.isNetworkFailure(WebViewClient.ERROR_HOST_LOOKUP, "net::ERR_NAME_NOT_RESOLVED"))
        assertTrue(Offline.isNetworkFailure(WebViewClient.ERROR_CONNECT, "net::ERR_CONNECTION_REFUSED"))
        assertTrue(Offline.isNetworkFailure(WebViewClient.ERROR_TIMEOUT, "net::ERR_TIMED_OUT"))
        assertTrue(Offline.isNetworkFailure(WebViewClient.ERROR_IO, null))
        assertTrue(Offline.isNetworkFailure(WebViewClient.ERROR_FAILED_SSL_HANDSHAKE, "net::ERR_SSL_PROTOCOL_ERROR"))
        // the web view reports some as "unknown": told apart by what it says
        assertTrue(Offline.isNetworkFailure(WebViewClient.ERROR_UNKNOWN, "net::ERR_INTERNET_DISCONNECTED"))
        assertTrue(Offline.isNetworkFailure(WebViewClient.ERROR_UNKNOWN, "net::ERR_NETWORK_CHANGED"))
    }

    @Test
    fun aLoadCancelledForTheNextOneIsNotOffline() {
        // reported after the next page has started: before 3.0.1 it left the offline screen over a page that loaded
        assertFalse(Offline.isNetworkFailure(WebViewClient.ERROR_UNKNOWN, "net::ERR_ABORTED"))
        assertFalse(Offline.isNetworkFailure(WebViewClient.ERROR_IO, "net::ERR_ABORTED"))
        assertFalse(Offline.isNetworkFailure(WebViewClient.ERROR_UNKNOWN, "net::ERR_CACHE_MISS"))
        assertFalse(Offline.isNetworkFailure(WebViewClient.ERROR_UNKNOWN, "net::ERR_BLOCKED_BY_RESPONSE"))
        assertFalse(Offline.isNetworkFailure(WebViewClient.ERROR_UNSUPPORTED_SCHEME, "net::ERR_UNKNOWN_URL_SCHEME"))
        assertFalse(Offline.isNetworkFailure(WebViewClient.ERROR_BAD_URL, null))
        assertFalse(Offline.isNetworkFailure(WebViewClient.ERROR_UNKNOWN, null))
    }

    @Test
    fun itTriesAgainBySoonerFirstThenEveryHalfMinute() {
        assertEquals(listOf(2_000L, 4_000L, 8_000L, 16_000L, 30_000L, 30_000L), (0..5).map { Offline.retryDelayMs(it) })
        assertEquals(2_000L, Offline.retryDelayMs(-1))
        assertEquals(30_000L, Offline.retryDelayMs(1_000))
    }
}
