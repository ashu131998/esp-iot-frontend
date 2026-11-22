package floorbeat.alerts

import org.json.JSONArray
import org.json.JSONObject

/** Which notification channel an alert rings on: the alarm (urgent: a machine stopped) or the ordinary one. */
enum class Ring { ALARM, ALERT }

/**
 * One pushed alert, as query-api sends it to the app (notify/fcm.js: every value a string): its id,
 * the English title and body, how urgent, the app page a tap opens, whether it asks a question, and
 * the facts behind it (payload.view, as JSON). Pure: PushMessageTest.
 */
data class PushMessage(
    val id: String,
    val title: String,
    val body: String,
    val severity: String,
    val path: String,
    val asks: Boolean,
    val facts: Facts?,
) {
    /** HIGH and CRITICAL alerts (a machine that stopped, one nobody answered for) ring like an alarm. */
    val ring: Ring get() = if (severity.uppercase() == "HIGH" || severity.uppercase() == "CRITICAL") Ring.ALARM else Ring.ALERT

    /** What the notification says, in the person's language when the facts came. */
    fun words(locale: String): Words = PushWords.wordsFor(facts, locale, asks) ?: Words(title, body)

    companion object {
        const val APP_NAME = "FloorBeat Alerts"

        /** The message from the push's data; null when it is not an alert (nothing to show). */
        fun from(data: Map<String, String>): PushMessage? {
            val id = data["notification_id"].orEmpty()
            val title = data["title"].orEmpty()
            val body = data["body"].orEmpty()
            if (id.isEmpty() && title.isEmpty() && body.isEmpty()) return null
            return PushMessage(
                id = id,
                title = title.ifEmpty { APP_NAME },
                body = body,
                severity = data["severity"].orEmpty(),
                path = AppUrls.tapPath(data["url"], id),
                asks = data["asks"] == "1" || data["asks"] == "true",
                facts = factsFrom(data["view"]),
            )
        }

        /** payload.view as the server sent it (JSON); null when absent or unreadable. */
        fun factsFrom(json: String?): Facts? {
            if (json.isNullOrBlank()) return null
            return try {
                val v = JSONObject(json)
                val kind = v.optString("kind")
                if (kind.isEmpty()) return null
                Facts(
                    kind = kind,
                    machine = v.optStringOrNull("machine").orEmpty(),
                    at = v.optStringOrNull("at"),
                    downForMin = v.optNumberOrNull("down_for_min"),
                    waitingMin = v.optNumberOrNull("waiting_min"),
                    shift = v.optStringOrNull("shift"),
                    start = v.optStringOrNull("start"),
                    task = v.optStringOrNull("task"),
                    machines = v.optStrings("machines"),
                    operators = v.optStrings("operators"),
                    asks = v.optStringOrNull("asks"),
                )
            } catch (e: Exception) {
                null
            }
        }

        private fun JSONObject.optStringOrNull(key: String): String? =
            if (!has(key) || isNull(key)) null else optString(key).takeIf { it.isNotEmpty() }

        private fun JSONObject.optNumberOrNull(key: String): Double? =
            if (!has(key) || isNull(key)) null else optDouble(key).takeIf { !it.isNaN() }

        private fun JSONObject.optStrings(key: String): List<String> {
            val array: JSONArray = optJSONArray(key) ?: return emptyList()
            return (0 until array.length()).mapNotNull { i -> if (array.isNull(i)) null else array.optString(i).takeIf { it.isNotEmpty() } }
        }
    }
}
