package floorbeat.alerts

import java.util.Locale

/**
 * The phone's maker, for the first-start set-up: many phones sold in India (Xiaomi, Redmi, Poco, Vivo,
 * iQOO, Oppo, Realme, OnePlus, Samsung, Huawei, Honor) stop apps in the background to save battery
 * unless the app is allowed to start on its own, and then alerts arrive late or not at all. Each maker
 * keeps that switch on its own screen; these are the screens known for each (the first one the phone
 * has is opened). Pure: PhoneMakerTest.
 */
object PhoneMaker {
    /** The maker's family, as the web app's set-up steps name it. */
    fun family(manufacturer: String?, brand: String? = null): String {
        val m = "${manufacturer.orEmpty()} ${brand.orEmpty()}".lowercase(Locale.ROOT)
        return when {
            listOf("xiaomi", "redmi", "poco").any { it in m } -> "xiaomi"
            listOf("vivo", "iqoo").any { it in m } -> "vivo"
            "realme" in m -> "realme"
            "oneplus" in m -> "oneplus"
            "oppo" in m -> "oppo"
            "samsung" in m -> "samsung"
            listOf("huawei", "honor").any { it in m } -> "huawei"
            "motorola" in m -> "motorola"
            "google" in m -> "google"
            else -> "other"
        }
    }

    /** The maker's "start on its own" (auto-start) screens, as package and activity, most likely first. */
    fun autostartScreens(family: String): List<Pair<String, String>> = when (family) {
        "xiaomi" -> listOf(
            "com.miui.securitycenter" to "com.miui.permcenter.autostart.AutoStartManagementActivity",
        )
        "vivo" -> listOf(
            "com.vivo.permissionmanager" to "com.vivo.permissionmanager.activity.BgStartUpManagerActivity",
            "com.iqoo.secure" to "com.iqoo.secure.ui.phoneoptimize.BgStartUpManager",
            "com.iqoo.secure" to "com.iqoo.secure.ui.phoneoptimize.AddWhiteListActivity",
        )
        "oppo", "realme", "oneplus" -> listOf(
            "com.coloros.safecenter" to "com.coloros.safecenter.permission.startup.StartupAppListActivity",
            "com.coloros.safecenter" to "com.coloros.safecenter.startupapp.StartupAppListActivity",
            "com.oppo.safe" to "com.oppo.safe.permission.startup.StartupAppListActivity",
            "com.oneplus.security" to "com.oneplus.security.chainlaunch.view.ChainLaunchAppListActivity",
        )
        "huawei" -> listOf(
            "com.huawei.systemmanager" to "com.huawei.systemmanager.startupmgr.ui.StartupNormalAppListActivity",
            "com.huawei.systemmanager" to "com.huawei.systemmanager.optimize.process.ProtectActivity",
        )
        "samsung" -> listOf(
            "com.samsung.android.lool" to "com.samsung.android.sm.battery.ui.BatteryActivity",
            "com.samsung.android.sm" to "com.samsung.android.sm.battery.ui.BatteryActivity",
        )
        else -> emptyList()
    }
}
