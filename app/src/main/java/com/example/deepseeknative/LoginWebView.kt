package com.example.deepseeknative

import android.annotation.SuppressLint
import android.webkit.*
import androidx.compose.runtime.*

@SuppressLint("SetJavaScriptEnabled")
@Composable
fun LoginWebView(onTokenReceived: (token: String, cookie: String) -> Unit) {
    AndroidView(
        factory = { context ->
            WebView(context).apply {
                settings.javaScriptEnabled = true
                settings.domStorageEnabled = true
                settings.userAgentString = "Mozilla/5.0 (Linux; Android 14) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36"
                webViewClient = object : WebViewClient() {
                    override fun onPageFinished(view: WebView?, url: String?) {
                        // Ekstrak token dari localStorage setelah login berhasil
                        view?.evaluateJavascript(
                            "JSON.parse(localStorage.getItem('userToken')).value"
                        ) { token ->
                            val cleanToken = token?.replace("\"", "") ?: ""
                            val cookie = CookieManager.getInstance().getCookie("https://chat.deepseek.com")
                            if (cleanToken.isNotBlank() && cookie != null) {
                                onTokenReceived(cleanToken, cookie)
                            }
                        }
                    }
                }
                loadUrl("https://chat.deepseek.com")
            }
        }
    )
}
