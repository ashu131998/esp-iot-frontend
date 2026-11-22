package floorbeat.alerts

import android.Manifest
import android.annotation.SuppressLint
import android.content.ActivityNotFoundException
import android.content.ComponentName
import android.content.Context
import android.content.Intent
import android.content.pm.PackageManager
import android.graphics.Color
import android.net.Uri
import android.os.Build
import android.os.Bundle
import android.os.PowerManager
import android.os.SystemClock
import android.provider.Settings
import android.view.Gravity
import android.view.View
import android.view.ViewGroup
import android.webkit.CookieManager
import android.webkit.RenderProcessGoneDetail
import android.webkit.WebChromeClient
import android.webkit.WebResourceError
import android.webkit.WebResourceRequest
import android.webkit.WebView
import android.webkit.WebViewClient
import android.widget.Button
import android.widget.FrameLayout
import android.widget.LinearLayout
import android.widget.TextView
import androidx.activity.ComponentActivity
import androidx.activity.OnBackPressedCallback
import androidx.activity.result.contract.ActivityResultContracts
import androidx.core.content.ContextCompat
import androidx.core.splashscreen.SplashScreen.Companion.installSplashScreen
import androidx.core.view.ViewCompat
import androidx.core.view.WindowCompat
import androidx.core.view.WindowInsetsCompat
import androidx.core.view.WindowInsetsControllerCompat
import androidx.webkit.WebSettingsCompat
import androidx.webkit.WebViewCompat
import androidx.webkit.WebViewFeature
import org.json.JSONObject

/**
 * The app's one screen: alerts.floorbeat.in in the phone's own web view (the same screens as on an
 * iPhone), with what an Android app does itself around it — the back button (AppUrls.back), a tapped
 * notification or an alerts.floorbeat.in link opening its page, other sites opening in the browser,
 * an offline screen, and the phone settings the set-up screens send the person to.
 */
class MainActivity : ComponentActivity() {
    private val appUrl = BuildConfig.APP_URL
    private lateinit var web: WebView
    private lateinit var offline: View
    private lateinit var bridge: Bridge
    private var firstPageShown = false
    private var loadFailed = false
    private var clearHistoryOnInbox = false
    private var notificationAsk: ((String) -> Unit)? = null

    private val askPermission = registerForActivityResult(ActivityResultContracts.RequestPermission()) {
        val state = notificationsState()
        notificationAsk?.invoke(state)
        notificationAsk = null
        bridge.event("notifications", state)
    }

    override fun onCreate(savedInstanceState: Bundle?) {
        val splash = installSplashScreen()
        super.onCreate(savedInstanceState)
        val started = SystemClock.uptimeMillis()
        splash.setKeepOnScreenCondition { !firstPageShown && SystemClock.uptimeMillis() - started < 4_000 }

        // Edge to edge (Android 15+ always is): the page sits between the status bar and the navigation bar.
        WindowCompat.setDecorFitsSystemWindows(window, false)
        val root = FrameLayout(this).apply { setBackgroundColor(Color.WHITE) }
        web = WebView(this)
        offline = offlineView()
        root.addView(web, FrameLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.MATCH_PARENT))
        root.addView(offline, FrameLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.MATCH_PARENT))
        ViewCompat.setOnApplyWindowInsetsListener(root) { view, insets ->
            val bars = insets.getInsets(WindowInsetsCompat.Type.systemBars() or WindowInsetsCompat.Type.displayCutout())
            val keyboard = insets.getInsets(WindowInsetsCompat.Type.ime())
            view.setPadding(bars.left, bars.top, bars.right, maxOf(bars.bottom, keyboard.bottom))
            WindowInsetsCompat.CONSUMED
        }
        setContentView(root)
        WindowInsetsControllerCompat(window, root).apply {
            isAppearanceLightStatusBars = true
            isAppearanceLightNavigationBars = true
        }

        bridge = Bridge(this)
        setUpWebView()
        onBackPressedDispatcher.addCallback(this, object : OnBackPressedCallback(true) {
            override fun handleOnBackPressed() = back()
        })
        web.loadUrl(pageFor(intent) ?: AppUrls.pageUrl(appUrl, "/"))
    }

    @SuppressLint("SetJavaScriptEnabled")
    private fun setUpWebView() {
        WebView.setWebContentsDebuggingEnabled(BuildConfig.DEBUG)
        web.settings.apply {
            javaScriptEnabled = true
            domStorageEnabled = true
            allowFileAccess = false
            allowContentAccess = false
            setSupportMultipleWindows(false)
            mediaPlaybackRequiresUserGesture = true
            // The web app knows it is inside the app by this (and by window.FloorBeatAndroid).
            userAgentString = "$userAgentString FloorBeatAlerts/${BuildConfig.VERSION_NAME} (Android)"
        }
        if (WebViewFeature.isFeatureSupported(WebViewFeature.ALGORITHMIC_DARKENING)) {
            WebSettingsCompat.setAlgorithmicDarkeningAllowed(web.settings, false)   // the app is light
        }
        CookieManager.getInstance().apply {
            setAcceptCookie(true)
            setAcceptThirdPartyCookies(web, false)
        }
        if (WebViewFeature.isFeatureSupported(WebViewFeature.WEB_MESSAGE_LISTENER)) {
            val origin = AppUrls.origin(appUrl) ?: "https://alerts.floorbeat.in"
            try {
                WebViewCompat.addWebMessageListener(web, "FloorBeatAndroid", setOf(origin), bridge)
            } catch (e: IllegalArgumentException) {
                // an address the web view will not give the bridge to: the pages run without it (and say "update")
            }
        }
        web.webChromeClient = WebChromeClient()
        web.webViewClient = object : WebViewClient() {
            override fun shouldOverrideUrlLoading(view: WebView, request: WebResourceRequest): Boolean {
                if (AppUrls.isAppPage(request.url.toString(), appUrl)) return false   // the app's own page: here
                openOutside(request.url)
                return true
            }

            override fun onPageStarted(view: WebView, url: String?, favicon: android.graphics.Bitmap?) {
                loadFailed = false
            }

            override fun onPageFinished(view: WebView, url: String?) {
                firstPageShown = true
                offline.visibility = if (loadFailed) View.VISIBLE else View.GONE
                // Back from an alert opened straight from a notification leads to the inbox; back from the inbox closes the app.
                if (clearHistoryOnInbox && AppUrls.isInbox(url, appUrl)) {
                    clearHistoryOnInbox = false
                    view.clearHistory()
                }
            }

            override fun onReceivedError(view: WebView, request: WebResourceRequest, error: WebResourceError) {
                if (request.isForMainFrame) {
                    loadFailed = true
                    offline.visibility = View.VISIBLE
                }
            }

            // The web view's renderer gone (out of memory): start the screen again rather than close the app.
            override fun onRenderProcessGone(view: WebView, detail: RenderProcessGoneDetail): Boolean {
                (view.parent as? ViewGroup)?.removeView(view)
                view.destroy()
                recreate()
                return true
            }
        }
        Push.listener = { event, value -> bridge.event(event, value) }
    }

    override fun onNewIntent(intent: Intent) {
        super.onNewIntent(intent)
        setIntent(intent)
        val page = pageFor(intent) ?: return
        if (page != web.url) web.loadUrl(page)
    }

    override fun onResume() {
        super.onResume()
        web.onResume()
        bridge.event("notifications", notificationsState())   // back from the phone's settings
    }

    override fun onPause() {
        web.onPause()
        CookieManager.getInstance().flush()   // the sign-in kept if the phone stops the app
        super.onPause()
    }

    override fun onDestroy() {
        if (Push.listener != null) Push.listener = null
        super.onDestroy()
    }

    /** The app page an intent opens: a tapped notification's alert, an alerts.floorbeat.in link. */
    private fun pageFor(intent: Intent?): String? {
        val url = intent?.data?.toString() ?: return null
        return if (AppUrls.isAppPage(url, appUrl)) url else null
    }

    /** The back button: the page first (an open live view closes), then AppUrls.back. */
    private fun back() {
        if (offline.visibility == View.VISIBLE) return leave()
        web.evaluateJavascript("(function(){try{return !!(window.floorbeatBack && window.floorbeatBack());}catch(e){return false;}})()") { handled ->
            if (handled == "true") return@evaluateJavascript
            when (AppUrls.back(web.canGoBack(), web.url, appUrl)) {
                Back.PAGE -> web.goBack()
                Back.INBOX -> {
                    clearHistoryOnInbox = true
                    web.loadUrl(AppUrls.pageUrl(appUrl, "/"))
                }
                Back.EXIT -> leave()
            }
        }
    }

    /** As Android 12+ does for an app's first screen: to the background, kept warm for the next open. */
    private fun leave() {
        moveTaskToBack(true)
    }

    private fun openOutside(uri: Uri) {
        try {
            startActivity(Intent(Intent.ACTION_VIEW, uri).addCategory(Intent.CATEGORY_BROWSABLE))
        } catch (e: ActivityNotFoundException) {
            // nothing on the phone opens it
        }
    }

    // ── for the set-up screens (Bridge) ────────────────────────────────────────────────────────

    private val prefs get() = getSharedPreferences("floorbeat_app", Context.MODE_PRIVATE)

    /** "on"; "off" (not asked yet: the app asks); "blocked" (refused, or switched off: only Settings turns it on). */
    fun notificationsState(): String {
        if (Notifications.state(this) == "on") return "on"
        if (Build.VERSION.SDK_INT >= 33 &&
            ContextCompat.checkSelfPermission(this, Manifest.permission.POST_NOTIFICATIONS) != PackageManager.PERMISSION_GRANTED
        ) {
            val asked = prefs.getBoolean("asked_notifications", false)
            return if (asked && !shouldShowRequestPermissionRationale(Manifest.permission.POST_NOTIFICATIONS)) "blocked" else "off"
        }
        return "blocked"   // allowed, but switched off in Settings (the app, or its alarm channel)
    }

    fun askNotifications(done: (String) -> Unit) {
        val state = notificationsState()
        if (state != "off" || Build.VERSION.SDK_INT < 33) return done(state)
        prefs.edit().putBoolean("asked_notifications", true).apply()
        notificationAsk = done
        askPermission.launch(Manifest.permission.POST_NOTIFICATIONS)
    }

    fun openNotificationSettings(): Boolean {
        val intent = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            Intent(Settings.ACTION_APP_NOTIFICATION_SETTINGS).putExtra(Settings.EXTRA_APP_PACKAGE, packageName)
        } else {
            appDetails()
        }
        return start(intent) || start(appDetails())
    }

    /** The app's page in Settings: Battery → Unrestricted lives there on most phones. */
    fun openBatterySettings(): Boolean = start(appDetails())

    /** The maker's "start on its own" screen when the phone has one; else the app's page in Settings. */
    fun openAutostartSettings(): Boolean {
        for ((pkg, cls) in PhoneMaker.autostartScreens(family())) {
            if (start(Intent().setComponent(ComponentName(pkg, cls)))) return true
        }
        start(appDetails())
        return false
    }

    fun hello(): JSONObject {
        val power = getSystemService(Context.POWER_SERVICE) as? PowerManager
        val family = family()
        return JSONObject()
            .put("version", BuildConfig.VERSION_NAME)
            .put("notifications", notificationsState())
            .put("push", Push.configured(this))
            .put("maker", family)
            .put("unrestricted", power?.isIgnoringBatteryOptimizations(packageName) ?: false)
            .put("autostart", PhoneMaker.autostartScreens(family).any { (pkg, cls) -> resolves(Intent().setComponent(ComponentName(pkg, cls))) })
            .put("android", Build.VERSION.SDK_INT)
    }

    private fun family() = PhoneMaker.family(Build.MANUFACTURER, Build.BRAND)

    private fun appDetails() = Intent(Settings.ACTION_APPLICATION_DETAILS_SETTINGS, Uri.parse("package:$packageName"))

    private fun resolves(intent: Intent): Boolean =
        try { intent.resolveActivity(packageManager) != null } catch (e: Exception) { false }

    private fun start(intent: Intent): Boolean = try {
        if (resolves(intent)) {
            startActivity(intent)
            true
        } else {
            false
        }
    } catch (e: Exception) {
        false   // a maker's screen that will not open for other apps
    }

    // ── no network ─────────────────────────────────────────────────────────────────────────────

    /** "You are offline", in the three languages (the page's language is not known without it). */
    private fun offlineView(): View {
        val dp = resources.displayMetrics.density
        val column = LinearLayout(this).apply {
            orientation = LinearLayout.VERTICAL
            gravity = Gravity.CENTER
            setPadding((24 * dp).toInt(), 0, (24 * dp).toInt(), 0)
            setBackgroundColor(Color.parseColor("#F8FAFC"))
            visibility = View.GONE
            isClickable = true
        }
        fun line(text: Int, size: Float, color: String, bold: Boolean = false) = TextView(this).apply {
            setText(text)
            textSize = size
            gravity = Gravity.CENTER
            setTextColor(Color.parseColor(color))
            if (bold) setTypeface(typeface, android.graphics.Typeface.BOLD)
            setPadding(0, (4 * dp).toInt(), 0, (4 * dp).toInt())
        }
        column.addView(line(R.string.offline_title, 20f, "#0F172A", bold = true))
        column.addView(line(R.string.offline_title_hi, 15f, "#64748B"))
        column.addView(line(R.string.offline_title_gu, 15f, "#64748B"))
        column.addView(line(R.string.offline_text, 15f, "#64748B"))
        column.addView(Button(this).apply {
            setText(R.string.offline_retry)
            setOnClickListener {
                offline.visibility = View.GONE
                web.reload()
            }
        }, LinearLayout.LayoutParams(ViewGroup.LayoutParams.WRAP_CONTENT, ViewGroup.LayoutParams.WRAP_CONTENT).apply {
            topMargin = (16 * dp).toInt()
        })
        return column
    }
}
