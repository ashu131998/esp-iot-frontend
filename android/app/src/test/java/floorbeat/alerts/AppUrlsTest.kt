package floorbeat.alerts

import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test

/** The app's addresses and the back button (AppUrls): FloorBeat, one app, on dashboard.floorbeat.in. */
class AppUrlsTest {
    private val app = "https://dashboard.floorbeat.in"

    @Test
    fun theAppsOwnPagesStayInTheAppEverythingElseOpensOutside() {
        assertTrue(AppUrls.isAppPage("https://dashboard.floorbeat.in/inbox/alerts/ntf-1", app))
        assertTrue(AppUrls.isAppPage("https://DASHBOARD.floorbeat.in:443/", app))
        assertFalse(AppUrls.isAppPage("https://floorbeat.in/privacy", app))
        assertFalse(AppUrls.isAppPage("http://dashboard.floorbeat.in/", app))
        assertFalse(AppUrls.isAppPage("https://dashboard.floorbeat.in.evil.example/", app))
        assertFalse(AppUrls.isAppPage("https://alerts.floorbeat.in/", app))   // the old address: mapped in (linkPage), never shown as it is
        assertFalse(AppUrls.isAppPage("tel:+911234", app))
        assertFalse(AppUrls.isAppPage(null, app))
        // a test build pointed at the computer
        assertTrue(AppUrls.isAppPage("http://10.0.2.2:3105/overview", "http://10.0.2.2:3105"))
        assertFalse(AppUrls.isAppPage("http://10.0.2.2:8101/v1/live/x", "http://10.0.2.2:3105"))
    }

    @Test
    fun theHomeScreenAndTheInbox() {
        assertTrue(AppUrls.isHome("https://dashboard.floorbeat.in", app))
        assertTrue(AppUrls.isHome("https://dashboard.floorbeat.in/", app))
        assertTrue(AppUrls.isHome("https://dashboard.floorbeat.in/?x=1", app))
        assertFalse(AppUrls.isHome("https://dashboard.floorbeat.in/overview", app))
        assertFalse(AppUrls.isHome("https://floorbeat.in/", app))

        assertTrue(AppUrls.isInbox("https://dashboard.floorbeat.in/inbox", app))
        assertTrue(AppUrls.isInbox("https://dashboard.floorbeat.in/inbox/", app))
        assertTrue(AppUrls.isInbox("https://dashboard.floorbeat.in/inbox/alerts", app))
        assertFalse(AppUrls.isInbox("https://dashboard.floorbeat.in/inbox/alerts/ntf-1", app))
        assertFalse(AppUrls.isInbox("https://dashboard.floorbeat.in/inbox/settings", app))
        assertFalse(AppUrls.isInbox("https://dashboard.floorbeat.in/", app))
        assertFalse(AppUrls.isInbox("https://dashboard.floorbeat.in/alerts", app))   // the dashboard's own Alerts page
    }

    @Test
    fun theBackButton() {
        val alert = "https://dashboard.floorbeat.in/inbox/alerts/ntf-1"
        // back through the app's own pages while there are any
        assertEquals(Back.PAGE, AppUrls.back(canGoBack = true, currentUrl = alert, appUrl = app))
        // an alert opened straight from a notification: to the inbox, not out of the app
        assertEquals(Back.INBOX, AppUrls.back(canGoBack = false, currentUrl = alert, appUrl = app))
        assertEquals(Back.INBOX, AppUrls.back(canGoBack = false, currentUrl = "https://dashboard.floorbeat.in/inbox/settings", appUrl = app))
        // the inbox, the dashboard, the stock, a link's page: to the home screen
        assertEquals(Back.HOME, AppUrls.back(canGoBack = false, currentUrl = "https://dashboard.floorbeat.in/inbox", appUrl = app))
        assertEquals(Back.HOME, AppUrls.back(canGoBack = false, currentUrl = "https://dashboard.floorbeat.in/overview", appUrl = app))
        assertEquals(Back.HOME, AppUrls.back(canGoBack = false, currentUrl = "https://dashboard.floorbeat.in/ims/add", appUrl = app))
        // the home screen (or the sign-in shown at "/"): the app goes to the background
        assertEquals(Back.EXIT, AppUrls.back(canGoBack = false, currentUrl = "https://dashboard.floorbeat.in/", appUrl = app))
        assertEquals(Back.EXIT, AppUrls.back(canGoBack = false, currentUrl = null, appUrl = app))
        assertEquals(Back.EXIT, AppUrls.back(canGoBack = false, currentUrl = "about:blank", appUrl = app))
    }

    @Test
    fun whereATappedNotificationGoes() {
        // the server names the alerts app's own page; inside the app it is under /inbox
        assertEquals("/inbox/alerts/ntf-1", AppUrls.tapPath("/alerts/ntf-1", "ntf-1"))
        assertEquals("/inbox/alerts/9b2f-41aa", AppUrls.tapPath(null, "9b2f-41aa"))
        assertEquals("/inbox/alerts/ntf-2", AppUrls.tapPath("https://evil.example/", "ntf-2"))
        assertEquals("/inbox/alerts/ntf-3", AppUrls.tapPath("//evil.example", "ntf-3"))
        assertEquals("/inbox", AppUrls.tapPath("/\\evil", "../x"))
        assertEquals("/inbox", AppUrls.tapPath(null, null))
        assertEquals("/inbox", AppUrls.tapPath("/", null))
        // a page already named in the inbox is kept
        assertEquals("/inbox/alerts/ntf-4", AppUrls.tapPath("/inbox/alerts/ntf-4", "ntf-4"))
        assertNull(AppUrls.alertPath("a/b"))
        assertEquals("https://dashboard.floorbeat.in/inbox/alerts/ntf-1", AppUrls.pageUrl("https://dashboard.floorbeat.in/", "/inbox/alerts/ntf-1"))
        assertEquals("https://dashboard.floorbeat.in/", AppUrls.pageUrl(app, "https://evil.example"))
    }

    @Test
    fun aLinkOpensItsPageInTheApp() {
        // the app's own pages as they are
        assertEquals("https://dashboard.floorbeat.in/overview", AppUrls.linkPage("https://dashboard.floorbeat.in/overview", app))
        // the alerts' old address (messages and emails already sent): the same page in the inbox
        assertEquals("https://dashboard.floorbeat.in/inbox/alerts/ntf-1", AppUrls.linkPage("https://alerts.floorbeat.in/alerts/ntf-1", app))
        assertEquals("https://dashboard.floorbeat.in/inbox", AppUrls.linkPage("https://alerts.floorbeat.in/", app))
        assertEquals("https://dashboard.floorbeat.in/inbox", AppUrls.linkPage("https://alerts.floorbeat.in", app))
        assertEquals("https://dashboard.floorbeat.in/inbox/settings?tab=battery", AppUrls.linkPage("https://alerts.floorbeat.in/settings?tab=battery", app))
        // anything else opens outside
        assertNull(AppUrls.linkPage("https://floorbeat.in/app", app))
        assertNull(AppUrls.linkPage("http://alerts.floorbeat.in/alerts/ntf-1", app))
        assertNull(AppUrls.linkPage("https://alerts.floorbeat.in.evil.example/", app))
        assertNull(AppUrls.linkPage(null, app))
        // a test build: the old address still maps into it
        assertEquals("http://10.0.2.2:3105/inbox/alerts/ntf-1", AppUrls.linkPage("https://alerts.floorbeat.in/alerts/ntf-1", "http://10.0.2.2:3105"))
    }
}
