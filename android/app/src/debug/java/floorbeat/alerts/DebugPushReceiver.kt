package floorbeat.alerts

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent

/**
 * Test builds only: a push handed in from the computer, the same way Firebase hands one to MessagingService:
 * adb shell am broadcast -a floorbeat.alerts.DEBUG_PUSH -p in.floorbeat.alerts --es notification_id ntf-1 --es title "Loom 3 stopped" ...
 */
class DebugPushReceiver : BroadcastReceiver() {
    override fun onReceive(context: Context, intent: Intent) {
        val extras = intent.extras ?: return
        val data = extras.keySet().associateWith { key -> extras.getString(key).orEmpty() }
        Push.received(context.applicationContext, data)
    }
}
