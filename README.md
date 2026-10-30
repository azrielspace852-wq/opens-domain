# DeepSeek Native Client (Unofficial)

Aplikasi Android native (Kotlin + Jetpack Compose) yang menggunakan `chat.deepseek.com` sebagai backend.

## ⚠️ Peringatan
Proyek ini menggunakan **API tidak resmi**. Penggunaan dapat melanggar ToS DeepSeek dan menyebabkan akun banned. Gunakan akun sekali pakai.

## Cara Build (GitHub Actions)
1. Push repo ke GitHub.
2. Buka tab **Actions** → **Build APK** → **Run workflow**.
3. Tunggu build selesai, download artifact `deepseek-native-debug`.

## Catatan Build
Proyek ini **tidak menyertakan Gradle Wrapper** (`gradlew`). Workflow memakai
`gradle/actions/setup-gradle@v4` dengan `gradle-version: 8.7` yang di-provision
otomatis ke `PATH`, lalu menjalankan `gradle assembleDebug`.

## Cara Kerja
- **Login**: WebView asli membuka `chat.deepseek.com` → hindari deteksi bot.
- **Chat**: UI native (Compose) → OkHttp → `/api/v0/chat/completion`.
- **PoW**: **Belum diimplementasikan penuh** (placeholder). Request chat kemungkinan
  gagal dengan `x-ds-pow-response` invalid. Lihat bagian keterbatasan.

## Keterbatasan
- PoW solver **belum lengkap** — untuk chat berfungsi, PoW harus diselesaikan di
  dalam konteks WebView (bukan native), karena memakai SHA3 yang ditandatangani server.
- Token perlu di-refresh manual jika expired.
- Workflow hanya build **debug APK** (signed dengan debug keystore). Untuk release,
  tambahkan signing config.
