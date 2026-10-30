# DeepSeek Native Client (Unofficial)

Aplikasi Android native (Kotlin + Jetpack Compose) yang menggunakan `chat.deepseek.com` sebagai backend.

## ⚠️ Peringatan
Proyek ini menggunakan API tidak resmi. Penggunaan dapat melanggar ToS DeepSeek dan menyebabkan akun banned. Gunakan akun sekali pakai.

## Cara Build
1. Push repo ke GitHub.
2. Buka tab **Actions** → **Build APK** → **Run workflow**.
3. Download artifact `deepseek-native-debug`.

## Cara Kerja
- **Login**: WebView asli membuka `chat.deepseek.com` untuk menghindari deteksi bot.
- **Chat**: UI native (Compose) mengirim request ke `/api/v0/chat/completion`.
- **PoW**: Harus diselesaikan di dalam WebView (lihat `PowBridge.kt`).

## Keterbatasan
- PoW solver belum diimplementasikan penuh (placeholder).
- Token perlu di-refresh manual jika expired.
