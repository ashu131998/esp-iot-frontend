package floorbeat.dashboard

import android.annotation.SuppressLint
import android.content.ActivityNotFoundException
import android.content.Intent
import android.graphics.Color
import android.net.Uri
import android.os.Bundle
import android.os.SystemClock
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
import androidx.core.splashscreen.SplashScreen.Companion.installSplashScreen
import androidx.core.view.ViewCompat
import androidx.core.view.WindowCompat
import androidx.core.view.WindowInsetsCompat
import androidx.core.view.WindowInsetsControllerCompat
import androidx.webkit.WebSettingsCompat
import androidx.webkit.WebViewFeature

/**
 * The app's one screen: dashboard.floorbeat.in in the phone's own web view (the same screens as in a
 * phone's browser and on an iPhone's Home Screen), with what an Android app does itself around it:
 * the back button (an open form or menu closes first, then back through the pages, then out), a
 * dashboard.floorbeat.in link opening its page, other addresses (a site, a phone number, an email)
 * opening outside, an offline screen, and the sign-in kept between starts.
 */
class MainActivity : ComponentActivity() {
    private val appUrl = BuildConfig.APP_URL
    private lateinit var web: WebView
    private lateinit var offline: View
    private var firstPageShown = false
    private var loadFailed = false

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
            mediaPlaybackRequiresUserGesture = true
            // The pages can tell they are inside the app by this.
            userAgentString = "$userAgentString FloorBeatDashboard/${BuildConfig.VERSION_NAME} (Android)"
        }
        if (WebViewFeature.isFeatureSupported(WebViewFeature.ALGORITHMIC_DARKENING)) {
            WebSettingsCompat.setAlgorithmicDarkeningAllowed(web.settings, false)   // the dashboard is light
        }
        CookieManager.getInstance().apply {
            setAcceptCookie(true)
            setAcceptThirdPartyCookies(web, false)
        }
        web.webChromeClient = WebChromeClient()
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
