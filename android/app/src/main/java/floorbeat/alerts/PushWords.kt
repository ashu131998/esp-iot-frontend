package floorbeat.alerts

import java.time.Instant
import java.time.ZoneId
import java.time.format.DateTimeFormatter
import java.util.Locale
import kotlin.math.max
import kotlin.math.roundToLong

/** The facts behind a pushed alert (query-api's payload.view): what happened, to which machine, when. */
data class Facts(
    val kind: String,
    val machine: String = "",
    /** When it happened (ISO time). */
    val at: String? = null,
    val downForMin: Double? = null,
    val waitingMin: Double? = null,
    val shift: String? = null,
    val start: String? = null,
    val task: String? = null,
    val machines: List<String> = emptyList(),
    val operators: List<String> = emptyList(),
    /** What a machine back up asks: "fix" (did you get it running?) or which configuration. */
    val asks: String? = null,
)

data class Words(val title: String, val body: String)

/**
 * A pushed alert's words in the person's language, from its facts: the same words as the web app's
 * service worker (public/alerts-sw.js wordsFor), so an alert rings in Hindi or Gujarati on both
 * phones. A kind without words here (a camera's, a newer one) shows what the server sent. Pure: PushWordsTest.
 */
object PushWords {
    private class W(
        val stopped: (String) -> String,
        val stoppedAt: (String, String) -> String,
        val why: String,
        val running: (String) -> String,
        val back: (String, String, String) -> String,
        val which: String,
        val fixed: String,
        val shift: (String, String) -> String,
        val shiftSoon: (String) -> String,
        val task: (String) -> String,
        val machines: (String) -> String,
        val asked: (String) -> String,
        val nobody: String,
        val h: String,
        val m: String,
        val still: (String) -> String,
        val waiting: (String, String) -> String,
        val stillNoTime: (String) -> String,
    )

    private val EN = W(
        stopped = { m -> "$m stopped" },
        stoppedAt = { m, t -> "$m stopped at $t." },
        why = "Why is it down? Tap an answer.",
        running = { m -> "$m is running again" },
        back = { m, t, d -> "$m came back at $t${if (d.isNotEmpty()) " after $d" else ""}." },
        which = "Which configuration is it running? Tap one.",
        fixed = "Did you get it running? Tap to answer.",
        shift = { s, t -> "$s starts at $t" },
        shiftSoon = { s -> "$s starts soon" },
        task = { x -> "Task: $x" },
        machines = { x -> "Machines: $x" },
        asked = { n -> "$n has been asked for the reason in the app." },
        nobody = "No operator is assigned to this machine right now.",
        h = "h",
        m = "m",
        still = { m -> "$m is still stopped" },
        waiting = { m, d -> "$m has been stopped for $d. Nobody has said why yet." },
        stillNoTime = { m -> "$m is still stopped. Nobody has said why yet." },
    )

    private val HI = W(
        stopped = { m -> "$m रुक गई" },
        stoppedAt = { m, t -> "$m $t पर रुक गई।" },
        why = "यह क्यों रुकी? एक जवाब पर टैप करें।",
        running = { m -> "$m फिर चल रही है" },
        back = { m, t, d -> "$m $t पर${if (d.isNotEmpty()) " $d के बाद" else ""} फिर चली।" },
        which = "यह कौन-सा कॉन्फ़िगरेशन चला रही है? एक पर टैप करें।",
        fixed = "क्या आपने इसे चला दिया? जवाब के लिए टैप करें।",
        shift = { s, t -> "$s $t पर शुरू होती है" },
        shiftSoon = { s -> "$s जल्द शुरू होती है" },
        task = { x -> "काम: $x" },
        machines = { x -> "मशीनें: $x" },
        asked = { n -> "$n से ऐप में कारण पूछा गया है।" },
        nobody = "अभी इस मशीन पर कोई ऑपरेटर नहीं है।",
        h = "घं",
        m = "मि",
        still = { m -> "$m अब भी रुकी है" },
        waiting = { m, d -> "$m $d से रुकी है। अभी तक किसी ने कारण नहीं बताया।" },
        stillNoTime = { m -> "$m अब भी रुकी है। अभी तक किसी ने कारण नहीं बताया।" },
    )

    private val GU = W(
        stopped = { m -> "$m બંધ થઈ" },
        stoppedAt = { m, t -> "$m $t વાગ્યે બંધ થઈ." },
        why = "તે કેમ બંધ છે? એક જવાબ પર ટૅપ કરો.",
        running = { m -> "$m ફરી ચાલે છે" },
        back = { m, t, d -> "$m $t વાગ્યે${if (d.isNotEmpty()) " $d પછી" else ""} ફરી ચાલી." },
        which = "તે કયું કૉન્ફિગરેશન ચલાવે છે? એક પર ટૅપ કરો.",
        fixed = "તમે તેને ચાલુ કરી? જવાબ માટે ટૅપ કરો.",
        shift = { s, t -> "$s $t વાગ્યે શરૂ થાય છે" },
        shiftSoon = { s -> "$s જલદી શરૂ થાય છે" },
        task = { x -> "કામ: $x" },
        machines = { x -> "મશીનો: $x" },
        asked = { n -> "$n ને ઍપમાં કારણ પૂછાયું છે." },
        nobody = "અત્યારે આ મશીન પર કોઈ ઑપરેટર નથી.",
        h = "ક",
        m = "મિ",
        still = { m -> "$m હજી બંધ છે" },
        waiting = { m, d -> "$m $d થી બંધ છે. હજી સુધી કોઈએ કારણ જણાવ્યું નથી." },
        stillNoTime = { m -> "$m હજી બંધ છે. હજી સુધી કોઈએ કારણ જણાવ્યું નથી." },
    )

    private fun words(locale: String): W = when (locale) {
        "hi" -> HI
        "gu" -> GU
        else -> EN
    }

    private val FACTORY_TIME: ZoneId = ZoneId.of("Asia/Kolkata")
    private val CLOCK: DateTimeFormatter = DateTimeFormatter.ofPattern("h:mm a", Locale.ENGLISH)

    /** "10:02 am", in factory time (IST); empty when the time cannot be read. */
    fun timeIn(iso: String?): String {
        if (iso.isNullOrBlank()) return ""
        return try {
            CLOCK.format(Instant.parse(iso).atZone(FACTORY_TIME)).lowercase(Locale.ENGLISH)
        } catch (e: Exception) {
            ""
        }
    }

    /** "1 h 12 m" in the person's language; at least a minute. */
    fun durationIn(locale: String, minutes: Double): String {
        val w = words(locale)
        val total = max(1L, minutes.roundToLong())
        val h = total / 60
        val m = total % 60
        return when {
            h > 0 && m > 0 -> "$h ${w.h} $m ${w.m}"
            h > 0 -> "$h ${w.h}"
            else -> "$m ${w.m}"
        }
    }

    /** The title and body in the person's language ("en", "hi", "gu"); null for a kind without words here. */
    fun wordsFor(facts: Facts?, locale: String, asks: Boolean): Words? {
        if (facts == null) return null
        val w = words(locale)
        val machine = facts.machine
        val time = timeIn(facts.at)
        val after = facts.downForMin?.takeIf { it > 0 }?.let { durationIn(locale, it) } ?: ""
        fun join(vararg parts: String, by: String = " ") = parts.filter { it.isNotEmpty() }.joinToString(by)
        return when (facts.kind) {
            "machine_down" -> Words(w.stopped(machine), join(if (time.isNotEmpty()) w.stoppedAt(machine, time) else "", if (asks) w.why else ""))
            "machine_up" -> Words(
                w.running(machine),
                join(if (time.isNotEmpty()) w.back(machine, time, after) else "", if (asks) (if (facts.asks == "fix") w.fixed else w.which) else ""),
            )
            "shift_reminder" -> {
                val start = timeIn(facts.start)
                val shift = facts.shift ?: ""
                Words(
                    if (start.isNotEmpty()) w.shift(shift, start) else w.shiftSoon(shift),
                    join(
                        if (!facts.task.isNullOrEmpty()) w.task(facts.task) else "",
                        if (facts.machines.isNotEmpty()) w.machines(facts.machines.joinToString(", ")) else "",
                        by = " · ",
                    ),
                )
            }
            "owner_down" -> {
                val names = facts.operators.filter { it.isNotEmpty() }
                Words(
                    w.stopped(machine),
                    join(if (time.isNotEmpty()) w.stoppedAt(machine, time) else "", if (names.isNotEmpty()) w.asked(names.joinToString(", ")) else w.nobody),
                )
            }
            "owner_up" -> Words(w.running(machine), if (time.isNotEmpty()) w.back(machine, time, after) else "")
            // Nobody answered: the supervisor gets the question, the owner is told.
            "machine_down_waiting", "owner_unanswered" -> {
                val waited = facts.waitingMin?.takeIf { it > 0 }?.let { w.waiting(machine, durationIn(locale, it)) } ?: w.stillNoTime(machine)
                Words(w.still(machine), join(waited, if (asks) w.why else ""))
            }
            else -> null
        }
    }
}
