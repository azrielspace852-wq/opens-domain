package com.example.deepseeknative

import okhttp3.MediaType.Companion.toMediaType
import okhttp3.OkHttpClient
import okhttp3.Request
import okhttp3.RequestBody.Companion.toRequestBody
import org.json.JSONObject
import java.util.concurrent.TimeUnit

class DeepSeekApi {
    private val client = OkHttpClient.Builder()
        .connectTimeout(30, TimeUnit.SECONDS)
        .readTimeout(60, TimeUnit.SECONDS)
        .build()

    var authToken: String = ""
    var sessionCookie: String = ""
    var chatSessionId: String = ""

    fun sendMessage(message: String): String {
        val json = JSONObject().apply {
            put("chat_session_id", chatSessionId)
            put("parent_message_id", JSONObject.NULL)
            put("prompt", message)
            put("ref_file_ids", org.json.JSONArray())
            put("thinking_enabled", false)
            put("search_enabled", false)
        }

        val body = json.toString().toRequestBody("application/json".toMediaType())
        val request = Request.Builder()
            .url("https://chat.deepseek.com/api/v0/chat/completion")
            .post(body)
            .addHeader("Authorization", "Bearer $authToken")
            .addHeader("Cookie", "ds_session_id=$sessionCookie")
            .addHeader("Content-Type", "application/json")
            .addHeader("User-Agent", "Mozilla/5.0 (Linux; Android 14) AppleWebKit/537.36")
            .build()

        client.newCall(request).execute().use { response ->
            if (!response.isSuccessful) throw Exception("HTTP ${response.code}: ${response.message}")
            return response.body?.string() ?: ""
        }
    }
}
