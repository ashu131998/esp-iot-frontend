package floorbeat.alerts

import com.google.firebase.messaging.FirebaseMessagingService
import com.google.firebase.messaging.RemoteMessage

/**
 * Firebase Cloud Messaging: query-api sends each alert as a high-priority data message to this phone's
 * Firebase Installation ID (FID; registration by FID is on in the manifest), which reaches the app with
 * the phone locked and the app closed; the app words it in the person's language and rings the right
 * channel (Push.received). FCM tells the app its FID once registered, and again whenever it changes.
 */
class MessagingService : FirebaseMessagingService() {
    override fun onMessageReceived(message: RemoteMessage) {
        Push.received(applicationContext, message.data)
    }

    override fun onRegistered(fid: String) {
        Push.registered(applicationContext, fid)
    }

    override fun onUnregistered(fid: String) {
        Push.unregistered(applicationContext, fid)
    }
}
