package floorbeat.alerts

import android.app.Application

/** The app: its notification channels made at every start (their names follow the phone's language). */
class FloorBeatApp : Application() {
    override fun onCreate() {
        super.onCreate()
        Notifications.createChannels(this)
    }
}
