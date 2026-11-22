package floorbeat.alerts

import android.Manifest
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.content.ContentResolver
import android.content.Context
import android.content.Intent
import android.content.pm.PackageManager
import android.media.AudioAttributes
import android.net.Uri
import android.os.Build
import androidx.core.app.NotificationCompat
import androidx.core.app.NotificationManagerCompat
import androidx.core.content.ContextCompat

/**
 * The app's notifications. Two channels (Android lets each be set in Settings): the alarm, for an
 * urgent alert (a machine that stopped, one nobody has answered for), with its own siren at the
 * alarm's volume; and the ordinary one, for the rest. A channel's sound cannot change once made: a new
 * sound needs a new channel id (strings.xml).
 */
object Notifications {
    private const val BRAND_COLOR = 0xFFEA580C.toInt()

    fun alarmChannel(context: Context) = context.getString(R.string.channel_alarm_id)
    fun alertChannel(context: Context) = context.getString(R.string.channel_alerts_id)

    /** Made at every start (cheap; names follow the phone's language). */
    fun createChannels(context: Context) {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) return
        val manager = context.getSystemService(NotificationManager::class.java) ?: return
        val siren = Uri.parse("${ContentResolver.SCHEME_ANDROID_RESOURCE}://${context.packageName}/${R.raw.machine_alarm}")
        val alarm = NotificationChannel(alarmChannel(context), context.getString(R.string.channel_alarm_name), NotificationManager.IMPORTANCE_HIGH).apply {
            description = context.getString(R.string.channel_alarm_description)
            setSound(
                siren,
                AudioAttributes.Builder()
                    .setUsage(AudioAttributes.USAGE_ALARM)
                    .setContentType(AudioAttributes.CONTENT_TYPE_SONIFICATION)
                    .build(),
            )
            enableVibration(true)
            vibrationPattern = longArrayOf(0, 600, 300, 600, 300, 600)
            enableLights(true)
            lightColor = BRAND_COLOR
            lockscreenVisibility = android.app.Notification.VISIBILITY_PUBLIC
        }
        val ordinary = NotificationChannel(alertChannel(context), context.getString(R.string.channel_alerts_name), NotificationManager.IMPORTANCE_HIGH).apply {
            description = context.getString(R.string.channel_alerts_description)
            enableVibration(true)
            lockscreenVisibility = android.app.Notification.VISIBILITY_PUBLIC
        }
        manager.createNotificationChannels(listOf(alarm, ordinary))
    }

    /** Whether this phone shows the app's notifications: allowed, and the alarm channel not switched off. */
    fun state(context: Context): String {
        val allowed = NotificationManagerCompat.from(context).areNotificationsEnabled() &&
            (Build.VERSION.SDK_INT < 33 || ContextCompat.checkSelfPermission(context, Manifest.permission.POST_NOTIFICATIONS) == PackageManager.PERMISSION_GRANTED)
        if (!allowed) return "off"
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            val manager = context.getSystemService(NotificationManager::class.java)
            val channel = manager?.getNotificationChannel(alarmChannel(context))
            if (channel != null && channel.importance == NotificationManager.IMPORTANCE_NONE) return "off"
        }
        return "on"
    }

    /** Opens the alert's page in the app (the running one, or a new start). */
    fun openIntent(context: Context, path: String): Intent =
        Intent(context, MainActivity::class.java)
            .setAction(Intent.ACTION_VIEW)
            .setData(Uri.parse(AppUrls.pageUrl(BuildConfig.APP_URL, path)))
            .addFlags(Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_SINGLE_TOP)

    /** Shows a pushed alert; a tap opens it. One notification per alert: a re-push replaces it and rings again. */
    fun show(context: Context, message: PushMessage, locale: String) {
        if (state(context) != "on") return
        val words = message.words(locale)
        val tag = message.id.ifEmpty { "alert" }
        val tap = PendingIntent.getActivity(
            context,
            tag.hashCode(),
            openIntent(context, message.path),
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE,
        )
        val alarm = message.ring == Ring.ALARM
        val notification = NotificationCompat.Builder(context, if (alarm) alarmChannel(context) else alertChannel(context))
            .setSmallIcon(R.drawable.ic_notification)
            .setColor(BRAND_COLOR)
            .setContentTitle(words.title)
            .setContentText(words.body)
            .setStyle(NotificationCompat.BigTextStyle().bigText(words.body))
            .setContentIntent(tap)
            .setAutoCancel(true)
            .setOnlyAlertOnce(false)
            .setShowWhen(true)
            .setWhen(System.currentTimeMillis())
            .setCategory(if (alarm) NotificationCompat.CATEGORY_ALARM else NotificationCompat.CATEGORY_MESSAGE)
            .setPriority(NotificationCompat.PRIORITY_HIGH)
            .setVisibility(NotificationCompat.VISIBILITY_PUBLIC)
            .build()
        try {
            NotificationManagerCompat.from(context).notify(tag, 1, notification)
        } catch (e: SecurityException) {
            // notifications switched off between the check and now: nothing to show
        }
    }
}
