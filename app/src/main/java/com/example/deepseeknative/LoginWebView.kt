package com.example.deepseeknative

import android.annotation.SuppressLint
import android.webkit.CookieManager
import android.webkit.WebView
import android.webkit.WebViewClient
import androidx.compose.runtime.Composable
import androidx.compose.ui.viewinterop.AndroidView

@SuppressLint("SetJavaScriptEnabled")
@Composable
fun LoginWebView(onTokenReceived: (token: String, cookie: String) -> Unit) {
    AndroidView(
        factory = { context ->
            WebView(context).apply {
                settings.javaScriptEnabled = true
                settings.domStorageEnabled = true
                settings.userAgentString =
                    "Mozilla/5.0 (Linux; Android 14) AppleWebKit/537.36 " +
                    "(KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36"
                webViewClient = object : WebViewClient() {
                    override fun onPageFinished(view: WebView?, url: String?) {
                        view?.evaluateJavascript(
                            "(function(){try{var t=JSON.parse(localStorage.getItem('userToken')||'{}');return t.value||'';}catch(e){return '';}})()"
                        ) { token ->
                            val clean = token?.replace("\"", "")?.trim().orEmpty()
                            val cookie = CookieManager.getInstance()
                                .getCookie("https://chat.deepseek.com").orEmpty()
                            if (clean.isNotBlank() && cookie.isNotBlank()) {
                                onTokenReceived(clean, cookie)
                            }
                        }
                    }
                }
                loadUrl("https://chat.deepseek.com")
            }
        }
    )
}
