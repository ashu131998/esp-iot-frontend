package floorbeat.alerts

import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Test

/** A pushed alert's words in the person's language: the same words as the web app's service worker. */
class PushWordsTest {
    private val at = "2026-11-17T04:32:00.000Z"   // 10:02 am in the factory (IST)

    @Test
    fun aStopThatAsksWhyInEachLanguage() {
        val down = Facts(kind = "machine_down", machine = "Loom 3", at = at)
        assertEquals(Words("Loom 3 stopped", "Loom 3 stopped at 10:02 am. Why is it down? Tap an answer."), PushWords.wordsFor(down, "en", asks = true))
        assertEquals(Words("Loom 3 stopped", "Loom 3 stopped at 10:02 am."), PushWords.wordsFor(down, "en", asks = false))
        assertEquals("Loom 3 रुक गई", PushWords.wordsFor(down, "hi", asks = true)?.title)
        assertEquals("Loom 3 10:02 am पर रुक गई। यह क्यों रुकी? एक जवाब पर टैप करें।", PushWords.wordsFor(down, "hi", asks = true)?.body)
        assertEquals("Loom 3 બંધ થઈ", PushWords.wordsFor(down, "gu", asks = false)?.title)
    }

    @Test
    fun backUpAndAfterHowLong() {
        val up = Facts(kind = "machine_up", machine = "Loom 3", at = at, downForMin = 72.0)
        assertEquals("Loom 3 came back at 10:02 am after 1 h 12 m. Which configuration is it running? Tap one.", PushWords.wordsFor(up, "en", asks = true)?.body)
        assertEquals("Loom 3 came back at 10:02 am after 1 h 12 m. Did you get it running? Tap to answer.", PushWords.wordsFor(up.copy(asks = "fix"), "en", asks = true)?.body)
        assertEquals("Loom 3 10:02 am વાગ્યે 1 ક 12 મિ પછી ફરી ચાલી.", PushWords.wordsFor(up, "gu", asks = false)?.body)
        assertEquals("Loom 3 is running again", PushWords.wordsFor(Facts(kind = "owner_up", machine = "Loom 3"), "en", asks = false)?.title)
    }

    @Test
    fun shiftsAndWhatAnOwnerHears() {
        val shift = Facts(kind = "shift_reminder", shift = "Day Shift", start = "2026-11-17T00:30:00.000Z", task = "Weaving", machines = listOf("Loom 3", "Loom 4"))
        assertEquals(Words("Day Shift starts at 6:00 am", "Task: Weaving · Machines: Loom 3, Loom 4"), PushWords.wordsFor(shift, "en", asks = false))
        assertEquals("Night starts soon", PushWords.wordsFor(Facts(kind = "shift_reminder", shift = "Night"), "en", asks = false)?.title)
        val owner = Facts(kind = "owner_down", machine = "Loom 3", at = at, operators = listOf("Ravi", ""))
        assertEquals("Loom 3 stopped at 10:02 am. Ravi has been asked for the reason in the app.", PushWords.wordsFor(owner, "en", asks = false)?.body)
        assertEquals("No operator is assigned to this machine right now.", PushWords.wordsFor(owner.copy(at = null, operators = emptyList()), "en", asks = false)?.body)
    }

    @Test
    fun aStopNobodyAnswered() {
        val waiting = Facts(kind = "machine_down_waiting", machine = "Loom 3", waitingMin = 12.0)
        assertEquals(Words("Loom 3 is still stopped", "Loom 3 has been stopped for 12 m. Nobody has said why yet. Why is it down? Tap an answer."), PushWords.wordsFor(waiting, "en", asks = true))
        assertEquals("Loom 3 is still stopped. Nobody has said why yet.", PushWords.wordsFor(Facts(kind = "owner_unanswered", machine = "Loom 3"), "en", asks = false)?.body)
        assertEquals("Loom 3 12 मि से रुकी है। अभी तक किसी ने कारण नहीं बताया।", PushWords.wordsFor(waiting, "hi", asks = false)?.body)
    }

    @Test
    fun aKindWithoutWordsHereShowsWhatTheServerSent() {
        assertNull(PushWords.wordsFor(Facts(kind = "camera_truck", machine = "Gate 1"), "hi", asks = false))
        assertNull(PushWords.wordsFor(null, "en", asks = false))
    }

    @Test
    fun timesAndDurations() {
        assertEquals("10:02 am", PushWords.timeIn(at))
        assertEquals("", PushWords.timeIn("not a time"))
        assertEquals("1 m", PushWords.durationIn("en", 0.2))
        assertEquals("2 h", PushWords.durationIn("en", 120.0))
        assertEquals("1 घं 5 मि", PushWords.durationIn("hi", 65.0))
    }
}
