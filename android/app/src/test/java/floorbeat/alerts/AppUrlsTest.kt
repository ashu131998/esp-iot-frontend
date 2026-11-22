package floorbeat.alerts

import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test

/** The app's addresses and the back button (AppUrls). */
class AppUrlsTest {
    private val app = "https://alerts.floorbeat.in"

    @Test
    fun theAppsOwnPagesStayInTheAppEverythingElseOpensOutside() {
        assertTrue(AppUrls.isAppPage("https://alerts.floorbeat.in/alerts/ntf-1", app))
        assertTrue(AppUrls.isAppPage("https://ALERTS.floorbeat.in:443/", app))
        assertFalse(AppUrls.isAppPage("https://floorbeat.in/privacy", app))
        assertFalse(AppUrls.isAppPage("http://alerts.floorbeat.in/", app))
        assertFalse(AppUrls.isAppPage("https://alerts.floorbeat.in.evil.example/", app))
        assertFalse(AppUrls.isAppPage("tel:+911234", app))
        assertFalse(AppUrls.isAppPage(null, app))
        // a test build pointed at the computer
        assertTrue(AppUrls.isAppPage("http://10.0.2.2:3105/settings", "http://10.0.2.2:3105"))
        assertFalse(AppUrls.isAppPage("http://10.0.2.2:8101/v1/live/x", "http://10.0.2.2:3105"))
    }

    @Test
    fun theInbox() {
        assertTrue(AppUrls.isInbox("https://alerts.floorbeat.in", app))
        assertTrue(AppUrls.isInbox("https://alerts.floorbeat.in/", app))
        assertTrue(AppUrls.isInbox("https://alerts.floorbeat.in/alerts", app))
        assertTrue(AppUrls.isInbox("https://alerts.floorbeat.in/?x=1", app))
        assertFalse(AppUrls.isInbox("https://alerts.floorbeat.in/alerts/ntf-1", app))
        assertFalse(AppUrls.isInbox("https://alerts.floorbeat.in/settings", app))
    }

    @Test
    fun theBackButton() {
        val alert = "https://alerts.floorbeat.in/alerts/ntf-1"
        // back through the app's own pages while there are any
        assertEquals(Back.PAGE, AppUrls.back(canGoBack = true, currentUrl = alert, appUrl = app))
        // an alert opened straight from a notification: to the inbox, not out of the app
        assertEquals(Back.INBOX, AppUrls.back(canGoBack = false, currentUrl = alert, appUrl = app))
        assertEquals(Back.INBOX, AppUrls.back(canGoBack = false, currentUrl = "https://alerts.floorbeat.in/settings", appUrl = app))
        // the inbox (or the sign-in shown at "/"): the app closes
        assertEquals(Back.EXIT, AppUrls.back(canGoBack = false, currentUrl = "https://alerts.floorbeat.in/", appUrl = app))
        assertEquals(Back.EXIT, AppUrls.back(canGoBack = false, currentUrl = null, appUrl = app))
        assertEquals(Back.EXIT, AppUrls.back(canGoBack = false, currentUrl = "about:blank", appUrl = app))
    }

    @Test
    fun whereATappedNotificationGoes() {
        assertEquals("/alerts/ntf-1", AppUrls.tapPath("/alerts/ntf-1", "ntf-1"))
        assertEquals("/alerts/9b2f-41aa", AppUrls.tapPath(null, "9b2f-41aa"))
        assertEquals("/alerts/ntf-2", AppUrls.tapPath("https://evil.example/", "ntf-2"))
        assertEquals("/alerts/ntf-3", AppUrls.tapPath("//evil.example", "ntf-3"))
        assertEquals("/", AppUrls.tapPath("/\\evil", "../x"))
        assertEquals("/", AppUrls.tapPath(null, null))
        assertNull(AppUrls.alertPath("a/b"))
        assertEquals("https://alerts.floorbeat.in/alerts/ntf-1", AppUrls.pageUrl("https://alerts.floorbeat.in/", "/alerts/ntf-1"))
        assertEquals("https://alerts.floorbeat.in/", AppUrls.pageUrl(app, "https://evil.example"))
    }
}
