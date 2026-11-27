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
import android.webkit.PermissionRequest
import android.webkit.RenderProcessGoneDetail
import android.webkit.ValueCallback
import android.webkit.WebChromeClient
import android.webkit.WebResourceError
import android.webkit.WebResourceRequest
import android.webkit.WebView
import android.webkit.WebViewClient
import android.widget.Button
import android.widget.FrameLayout
import android.widget.LinearLayout
import android.widget.TextView
import android.widget.Toast
import androidx.activity.ComponentActivity
import androidx.activity.OnBackPressedCallback
import androidx.activity.result.contract.ActivityResultContracts
import androidx.core.content.ContextCompat
import androidx.core.content.FileProvider
import androidx.core.splashscreen.SplashScreen.Companion.installSplashScreen
import androidx.core.view.ViewCompat
import androidx.core.view.WindowCompat
import androidx.core.view.WindowInsetsCompat
import androidx.core.view.WindowInsetsControllerCompat
import androidx.webkit.WebSettingsCompat
import androidx.webkit.WebViewCompat
import androidx.webkit.WebViewFeature
import org.json.JSONObject
import java.io.File

/**
 * The app's one screen: FloorBeat (dashboard.floorbeat.in; one app since 3.0.0, its home screen a tile for each of
 * the person's apps: alerts, dashboard, stock) in the phone's own web view, the same screens as on an iPhone's Home
 * Screen and in a computer's browser, with what an Android app does itself around it:
 *  - notifications (Firebase: MessagingService, Notifications), a tapped one opening its alert (/inbox/alerts/<id>);
 *  - the back button: an open form, menu or live view closes first, then back through the pages, then an alert to
 *    the inbox and any other page to the home screen, then out (AppUrls.back);
 *  - the camera for the stock: a photo field's "Take photo" opens the camera app and "Choose from phone" the phone's
 *    picker; a page asking for the camera itself gets it after Android's "Allow camera", only the camera, only here;
 *  - a dashboard.floorbeat.in link, or one to the alerts' old address (alerts.floorbeat.in), opening its page; other
 *    addresses (a site, a phone number, an email) opening outside;
 *  - an offline screen, the phone settings the set-up screens send the person to, and the sign-in and the phone's
 *    unsent stock and photos kept between starts (cookies, local storage and IndexedDB: the app never clears them).
 */
class MainActivity : ComponentActivity() {
    private val appUrl = BuildConfig.APP_URL
    private lateinit var web: WebView
    private lateinit var offline: View
    private lateinit var bridge: Bridge
    private var firstPageShown = false
    private var loadFailed = false
    /** Where the back button sent the app (the inbox, the home screen): what was behind it is forgotten once it shows. */
    private var clearHistoryOn: Back? = null
    private var notificationAsk: ((String) -> Unit)? = null

    /** The page's file input waiting for a photo, and the camera's photo file while the camera app has it. */
    private var fileCallback: ValueCallback<Array<Uri>>? = null
    private var cameraPhoto: Uri? = null
    /** A page's camera request (getUserMedia) waiting for Android's "Allow camera" answer. */
    private var cameraRequest: PermissionRequest? = null
    /** What to do once Android has answered "Allow camera". */
    private var afterCameraAnswer: ((Boolean) -> Unit)? = null

    private val askPermission = registerForActivityResult(ActivityResultContracts.RequestPermission()) {
        val state = notificationsState()
        notificationAsk?.invoke(state)
        notificationAsk = null
        bridge.event("notifications", state)
    }

    private val askCamera = registerForActivityResult(ActivityResultContracts.RequestPermission()) { granted ->
        val next = afterCameraAnswer
        afterCameraAnswer = null
        if (!granted) Toast.makeText(this, R.string.camera_off, Toast.LENGTH_LONG).show()
        next?.invoke(granted)
    }

    private val takePicture = registerForActivityResult(ActivityResultContracts.TakePicture()) { saved ->
        val photo = cameraPhoto
        cameraPhoto = null
        answerFile(if (saved && photo != null) arrayOf(photo) else null)
    }

    private val pickFile = registerForActivityResult(ActivityResultContracts.GetContent()) { uri ->
        answerFile(uri?.let { arrayOf(it) })
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
        clearOldPhotos()
        setUpWebView()
        onBackPressedDispatcher.addCallback(this, object : OnBackPressedCallback(true) {
            override fun handleOnBackPressed() = back()
        })
        // The page it was on, should Android have stopped the app in the background (the camera app open, say);
        // else the page a tapped notification or a link opens; else the home screen.
        if (savedInstanceState == null || web.restoreState(savedInstanceState) == null) {
            web.loadUrl(pageFor(intent) ?: AppUrls.pageUrl(appUrl, "/"))
        }
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
            // a page's camera preview plays as soon as the camera is allowed
            mediaPlaybackRequiresUserGesture = false
            // The web app knows it is inside the app by this (and by window.FloorBeatAndroid). The mark keeps the
            // name it had before the apps became one (src/lib/alerts-app/native.ts reads it).
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
            val origin = AppUrls.origin(appUrl) ?: "https://dashboard.floorbeat.in"
            try {
                WebViewCompat.addWebMessageListener(web, "FloorBeatAndroid", setOf(origin), bridge)
            } catch (e: IllegalArgumentException) {
                // an address the web view will not give the bridge to: the pages run without it (and say "update")
            }
        }
        web.webChromeClient = object : WebChromeClient() {
            // a page asking for the camera itself (getUserMedia)
            override fun onPermissionRequest(request: PermissionRequest) {
                runOnUiThread { answerCameraRequest(request) }
            }

            override fun onPermissionRequestCanceled(request: PermissionRequest) {
                if (cameraRequest == request) cameraRequest = null
            }

            // a photo field's "Take photo" or "Choose from phone"
            override fun onShowFileChooser(view: WebView, callback: ValueCallback<Array<Uri>>, params: FileChooserParams): Boolean {
                fileCallback?.onReceiveValue(null)   // an earlier one never answered: let it go
                fileCallback = callback
                val types = params.acceptTypes?.toList() ?: emptyList()
                when (PhotoPick.kind(params.isCaptureEnabled, types)) {
                    Pick.CAMERA -> withCamera { allowed -> if (allowed) openCamera() else answerFile(null) }
                    Pick.LIBRARY -> try {
                        pickFile.launch(PhotoPick.mimeType(types))
                    } catch (e: ActivityNotFoundException) {
                        answerFile(null)
                    }
                }
                return true
            }
        }
        web.webViewClient = object : WebViewClient() {
            override fun shouldOverrideUrlLoading(view: WebView, request: WebResourceRequest): Boolean {
                val url = request.url.toString()
                if (AppUrls.isAppPage(url, appUrl)) return false   // the app's own page: here
                val page = AppUrls.linkPage(url, appUrl)            // the alerts' old address: its page here
                if (page != null) view.loadUrl(page) else openOutside(request.url)
                return true
            }

            override fun onPageStarted(view: WebView, url: String?, favicon: android.graphics.Bitmap?) {
                loadFailed = false
            }

            override fun onPageFinished(view: WebView, url: String?) {
                firstPageShown = true
                offline.visibility = if (loadFailed) View.VISIBLE else View.GONE
                // Sent back to the inbox or the home screen: back from there goes on up (home, then out), not round again.
                val arrived = when (clearHistoryOn) {
                    Back.INBOX -> AppUrls.isInbox(url, appUrl)
                    Back.HOME -> AppUrls.isHome(url, appUrl)
                    else -> false
                }
                if (arrived) {
                    clearHistoryOn = null
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

    /** A tapped notification, or a link, while the app is open: its page. */
    override fun onNewIntent(intent: Intent) {
        super.onNewIntent(intent)
        setIntent(intent)
        val page = pageFor(intent) ?: return
        if (page != web.url) web.loadUrl(page)
    }

    override fun onSaveInstanceState(outState: Bundle) {
        super.onSaveInstanceState(outState)
        try {
            web.saveState(outState)   // the page it was on, should Android stop the app in the background
        } catch (e: Exception) {
            // a web view already gone (its renderer stopped): the app starts at its first page
        }
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

    /** The app page an intent opens: a tapped notification's alert, a dashboard.floorbeat.in or alerts.floorbeat.in link. */
    private fun pageFor(intent: Intent?): String? = AppUrls.linkPage(intent?.data?.toString(), appUrl)

    /** The back button: the page first (an open form, menu or live view closes), then AppUrls.back. */
    private fun back() {
        if (offline.visibility == View.VISIBLE) return leave()
        web.evaluateJavascript("(function(){try{return !!(window.floorbeatBack && window.floorbeatBack());}catch(e){return false;}})()") { handled ->
            if (handled == "true") return@evaluateJavascript
            when (AppUrls.back(web.canGoBack(), web.url, appUrl)) {
                Back.PAGE -> web.goBack()
                Back.INBOX -> goUp(Back.INBOX, AppUrls.INBOX)
                Back.HOME -> goUp(Back.HOME, "/")
                Back.EXIT -> leave()
            }
        }
    }

    private fun goUp(to: Back, path: String) {
        clearHistoryOn = to
        web.loadUrl(AppUrls.pageUrl(appUrl, path))
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

    // ── the camera and photos (the stock) ─────────────────────────────────────────────────────

    /** The camera for a page that asks for it: only the app's own pages, only the camera, after Android's question. */
    private fun answerCameraRequest(request: PermissionRequest) {
        val allowed = PhotoPick.cameraResources(request.resources.toList(), request.origin?.toString(), appUrl)
        if (allowed.isEmpty()) return request.deny()
        cameraRequest?.deny()
        cameraRequest = request
        withCamera { granted ->
            val waiting = cameraRequest
            cameraRequest = null
            if (waiting == null) return@withCamera
            if (granted) waiting.grant(allowed.toTypedArray()) else waiting.deny()
        }
    }

    /** Runs `then` with whether the camera may be used: asks Android first when it has not been allowed yet. */
    private fun withCamera(then: (Boolean) -> Unit) {
        if (ContextCompat.checkSelfPermission(this, Manifest.permission.CAMERA) == PackageManager.PERMISSION_GRANTED) return then(true)
        afterCameraAnswer = then
        askCamera.launch(Manifest.permission.CAMERA)
    }

    /** The camera app, writing its photo into the app's cache (handed to the page, which makes it small). */
    private fun openCamera() {
        try {
            val dir = File(cacheDir, "photos").apply { mkdirs() }
            val file = File(dir, "photo-${System.currentTimeMillis()}.jpg")
            val uri = FileProvider.getUriForFile(this, "${packageName}.photos", file)
            cameraPhoto = uri
            takePicture.launch(uri)
        } catch (e: Exception) {
            // no camera app on the phone, or the cache could not be written
            cameraPhoto = null
            answerFile(null)
        }
    }

    private fun answerFile(files: Array<Uri>?) {
        fileCallback?.onReceiveValue(files)
        fileCallback = null
    }

    /**
     * Camera photos from earlier days: the page made its own small copies of them long since. Not today's: on
     * a phone short of memory Android may restart the app while the camera app is open.
     */
    private fun clearOldPhotos() {
        val dayAgo = System.currentTimeMillis() - 24 * 60 * 60 * 1000L
        File(cacheDir, "photos").listFiles()?.filter { it.lastModified() < dayAgo }?.forEach { it.delete() }
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
