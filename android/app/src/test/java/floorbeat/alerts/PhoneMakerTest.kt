package floorbeat.alerts

import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test

/** The phone makers whose battery savers stop apps, and their "start on its own" screens. */
class PhoneMakerTest {
    @Test
    fun theMakersFamily() {
        assertEquals("xiaomi", PhoneMaker.family("Xiaomi", "Redmi"))
        assertEquals("xiaomi", PhoneMaker.family("Xiaomi", "POCO"))
        assertEquals("vivo", PhoneMaker.family("vivo", "iQOO"))
        assertEquals("realme", PhoneMaker.family("realme", "realme"))
        assertEquals("oppo", PhoneMaker.family("OPPO", "OPPO"))
        assertEquals("oneplus", PhoneMaker.family("OnePlus", "OnePlus"))
        assertEquals("samsung", PhoneMaker.family("samsung", "samsung"))
        assertEquals("huawei", PhoneMaker.family("HONOR", null))
        assertEquals("google", PhoneMaker.family("Google", "google"))
        assertEquals("other", PhoneMaker.family(null, null))
    }

    @Test
    fun eachMakersAutoStartScreens() {
        assertTrue(PhoneMaker.autostartScreens("xiaomi").first().second.endsWith("AutoStartManagementActivity"))
        assertTrue(PhoneMaker.autostartScreens("realme").isNotEmpty())
        assertTrue(PhoneMaker.autostartScreens("vivo").size >= 2)
        assertTrue(PhoneMaker.autostartScreens("google").isEmpty())
    }
}
