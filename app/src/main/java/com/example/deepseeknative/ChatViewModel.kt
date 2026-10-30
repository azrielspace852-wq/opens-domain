package com.example.deepseeknative

import androidx.compose.runtime.mutableStateListOf
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import kotlinx.coroutines.launch

data class ChatMessage(val role: String, val content: String)

class ChatViewModel : ViewModel() {
    val messages = mutableStateListOf<ChatMessage>()
    var isLoading by mutableStateOf(false)
        private set

    private val api = DeepSeekApi()

    fun send(text: String) {
        messages.add(ChatMessage("user", text))
        isLoading = true
        viewModelScope.launch {
            try {
                val reply = api.sendMessage(text)
                messages.add(ChatMessage("assistant", reply))
            } catch (e: Exception) {
                messages.add(ChatMessage("assistant", "Error: ${e.message}"))
            } finally {
                isLoading = false
            }
        }
    }
}
