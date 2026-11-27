package floorbeat.dashboard

import android.Manifest
import android.annotation.SuppressLint
import android.content.ActivityNotFoundException
import android.content.Intent
import android.content.pm.PackageManager
import android.graphics.Color
import android.net.Uri
import android.os.Bundle
import android.os.SystemClock
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
import androidx.webkit.WebViewFeature
import java.io.File

/**
 * The app's one screen: dashboard.floorbeat.in in the phone's own web view (the same screens as in a phone's
 * browser and on an iPhone's Home Screen), with what an Android app does itself around it:
 *  - the camera, for the Stock tab (FloorBeat IMS inside the dashboard: one app, 2026-11-27): its QR scanner
 *    (getUserMedia) after Android's own "Allow camera" question, and a photo field's "Take photo" (the camera
 *    app) and "Choose from phone" (the phone's photos and files);
 *  - the back button (an open form or menu closes first, then back through the pages, then out);
 *  - a dashboard.floorbeat.in link opening its page, other addresses (a site, a phone number, an email)
 *    opening outside;
 *  - an offline screen, and the sign-in and the phone's unsent scans and photos kept between starts
 *    (cookies, local storage and IndexedDB stay with the app; the app never clears them).
 */
class MainActivity : ComponentActivity() {
    private val appUrl = BuildConfig.APP_URL
    private lateinit var web: WebView
    private lateinit var offline: View
    private var firstPageShown = false
    private var loadFailed = false

    /** The page's file input waiting for a photo, and the camera's photo file while the camera app has it. */
    private var fileCallback: ValueCallback<Array<Uri>>? = null
    private var cameraPhoto: Uri? = null
    /** The page's camera request (the QR scanner) waiting for Android's "Allow camera" answer. */
    private var cameraRequest: PermissionRequest? = null
    /** What to do once Android has answered "Allow camera". */
    private var afterCameraAnswer: ((Boolean) -> Unit)? = null

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

        clearOldPhotos()
        setUpWebView()
        onBackPressedDispatcher.addCallback(this, object : OnBackPressedCallback(true) {
            override fun handleOnBackPressed() = back()
        })
        if (savedInstanceState == null || web.restoreState(savedInstanceState) == null) {
            web.loadUrl(AppLinks.startUrl(intent?.data?.toString(), appUrl))
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
            // the QR scanner's camera preview plays as soon as the camera is allowed
            mediaPlaybackRequiresUserGesture = false
            // The pages can tell they are inside the app by this.
            userAgentString = "$userAgentString FloorBeatDashboard/${BuildConfig.VERSION_NAME} (Android)"
        }
        if (WebViewFeature.isFeatureSupported(WebViewFeature.ALGORITHMIC_DARKENING)) {
            WebSettingsCompat.setAlgorithmicDarkeningAllowed(web.settings, false)   // the app is light
        }
        CookieManager.getInstance().apply {
            setAcceptCookie(true)
            setAcceptThirdPartyCookies(web, false)
        }
        web.webChromeClient = object : WebChromeClient() {
            // the page's QR scanner asks for the camera
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
                if (AppLinks.isAppPage(request.url.toString(), appUrl)) return false   // the app's own page: here
                openOutside(request.url)
                return true
            }

            override fun onPageStarted(view: WebView, url: String?, favicon: android.graphics.Bitmap?) {
                loadFailed = false
            }

            override fun onPageFinished(view: WebView, url: String?) {
                firstPageShown = true
                offline.visibility = if (loadFailed) View.VISIBLE else View.GONE
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
    }

    /** The camera for the page's QR scanner: only the app's own pages, only the camera, after Android's question. */
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

    /** A dashboard.floorbeat.in link tapped while the app is open: its page. */
    override fun onNewIntent(intent: Intent) {
        super.onNewIntent(intent)
        setIntent(intent)
        val link = intent.data?.toString() ?: return
        if (AppLinks.isAppPage(link, appUrl) && link != web.url) web.loadUrl(link)
    }

    override fun onSaveInstanceState(outState: Bundle) {
        super.onSaveInstanceState(outState)
        web.saveState(outState)   // the page it was on, should Android stop the app in the background
    }

    override fun onResume() {
        super.onResume()
        web.onResume()
    }

    override fun onPause() {
        web.onPause()
        CookieManager.getInstance().flush()   // the sign-in kept if the phone stops the app
        super.onPause()
    }

    /**
     * The back button: the page first (an open form or menu closes: window.floorbeatBack), then back
     * through the app's pages, then out.
     */
    private fun back() {
        if (offline.visibility == View.VISIBLE) return leave()
        web.evaluateJavascript("(function(){try{return !!(window.floorbeatBack && window.floorbeatBack());}catch(e){return false;}})()") { handled ->
            if (handled == "true") return@evaluateJavascript
            when (AppLinks.back(web.canGoBack())) {
                Back.PAGE -> web.goBack()
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
