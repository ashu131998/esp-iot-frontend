package floorbeat.alerts

import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test

/** A push as query-api sends it to the app (notify/fcm.js): every value a string. */
class PushMessageTest {
    private val down = mapOf(
        "notification_id" to "ntf-1", "title" to "🔴 Loom 3 is DOWN", "body" to "Loom 3 stopped at 10:02", "severity" to "HIGH",
        "url" to "/alerts/ntf-1", "asks" to "1", "type" to "machine_down",
        "view" to """{"kind":"machine_down","machine":"Loom 3","at":"2026-11-17T04:32:00.000Z"}""",
    )

    @Test
    fun aStopRingsTheAlarmInThePersonsLanguageAndOpensItsAlert() {
        val m = PushMessage.from(down)!!
        assertEquals("ntf-1", m.id)
        assertEquals("/inbox/alerts/ntf-1", m.path)   // its page in the app's inbox
        assertTrue(m.asks)
        assertEquals(Ring.ALARM, m.ring)
        assertEquals("Loom 3 रुक गई", m.words("hi").title)
    }

    @Test
    fun aMediumOneRingsTheOrdinaryChannelAKindWithoutWordsShowsTheServersText() {
        val truck = PushMessage.from(mapOf(
            "notification_id" to "ntf-2", "title" to "A truck at camera cam-1 at Gate 1 (4:42 pm).", "body" to "", "severity" to "MEDIUM",
            "url" to "/alerts/ntf-2", "asks" to "", "view" to """{"kind":"camera_truck","camera":"cam-1","machine":"Gate 1","picture_id":42}""",
        ))!!
        assertEquals(Ring.ALERT, truck.ring)
        assertFalse(truck.asks)
        assertEquals(Words("A truck at camera cam-1 at Gate 1 (4:42 pm).", ""), truck.words("gu"))
        assertEquals(Ring.ALARM, PushMessage.from(mapOf("notification_id" to "x", "severity" to "critical"))!!.ring)
    }

    @Test
    fun theFactsReadFromTheirJson() {
        val f = PushMessage.factsFrom("""{"kind":"shift_reminder","shift":"Day","start":"2026-11-17T00:30:00Z","machines":["Loom 3",null,""],"down_for_min":null,"task":""}""")!!
        assertEquals("shift_reminder", f.kind)
        assertEquals(listOf("Loom 3"), f.machines)
        assertNull(f.downForMin)
        assertNull(f.task)
        assertEquals(12.0, PushMessage.factsFrom("""{"kind":"machine_down_waiting","waiting_min":12}""")!!.waitingMin!!, 0.0)
        assertNull(PushMessage.factsFrom("not json"))
        assertNull(PushMessage.factsFrom("""{"machine":"x"}"""))
        assertNull(PushMessage.factsFrom(null))
    }

    @Test
    fun anEmptyPushIsNotAnAlertOneWithoutATitleNamesTheApp() {
        assertNull(PushMessage.from(emptyMap()))
        val bare = PushMessage.from(mapOf("notification_id" to "ntf-9"))!!
        assertEquals("FloorBeat Alerts", bare.title)
        assertEquals("/inbox/alerts/ntf-9", bare.path)
        assertEquals("/inbox", PushMessage.from(mapOf("title" to "Test", "url" to "/"))!!.path)
    }
}
