package floorbeat.ims

import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test

class AppLinksTest {
    private val app = "https://ims.floorbeat.in"

    @Test
    fun `an address's origin, the port only when it is not the scheme's own`() {
        assertEquals("https://ims.floorbeat.in", AppLinks.origin("https://Ims.FloorBeat.in/alerts?x=1"))
        assertEquals("https://ims.floorbeat.in", AppLinks.origin("https://ims.floorbeat.in:443/"))
        assertEquals("http://10.0.2.2:3105", AppLinks.origin("http://10.0.2.2:3105/alerts"))
        assertEquals("http://localhost", AppLinks.origin("http://localhost:80"))
        assertNull(AppLinks.origin("tel:+919876543210"))
        assertNull(AppLinks.origin("mailto:support@floorbeat.in"))
        assertNull(AppLinks.origin("intent://x#Intent;end"))
        assertNull(AppLinks.origin("not a url"))
        assertNull(AppLinks.origin(""))
        assertNull(AppLinks.origin(null))
    }

    @Test
    fun `the app's own pages stay in the app, everything else opens outside`() {
        assertTrue(AppLinks.isAppPage("https://ims.floorbeat.in/", app))
        assertTrue(AppLinks.isAppPage("https://ims.floorbeat.in/stock?spec.grade=a", app))
        assertFalse(AppLinks.isAppPage("https://alerts.floorbeat.in/", app))
        assertFalse(AppLinks.isAppPage("https://shree-mills.floorbeat.in/", app))
        assertFalse(AppLinks.isAppPage("https://floorbeat.in/privacy", app))
        assertFalse(AppLinks.isAppPage("http://ims.floorbeat.in/", app))
        assertFalse(AppLinks.isAppPage("https://ims.floorbeat.in.evil.example/", app))
        assertFalse(AppLinks.isAppPage("tel:+919876543210", app))
        assertFalse(AppLinks.isAppPage(null, app))
        assertTrue(AppLinks.isAppPage("http://10.0.2.2:3105/alerts", "http://10.0.2.2:3105"))
    }

    @Test
    fun `it starts on the link it was opened with when that is its own, else on its first page`() {
        assertEquals("https://ims.floorbeat.in/", AppLinks.home(app))
        assertEquals("https://ims.floorbeat.in/", AppLinks.home("$app/"))
        assertEquals("https://ims.floorbeat.in/", AppLinks.startUrl(null, app))
        assertEquals("https://ims.floorbeat.in/stock?spec.grade=a", AppLinks.startUrl(" https://ims.floorbeat.in/stock?spec.grade=a ", app))
        assertEquals("https://ims.floorbeat.in/", AppLinks.startUrl("https://evil.example/", app))
    }

    @Test
    fun `back goes through the pages, then out`() {
        assertEquals(Back.PAGE, AppLinks.back(true))
        assertEquals(Back.EXIT, AppLinks.back(false))
    }
}
