# DeepSeek Native Client (Unofficial)

Aplikasi Android native (Kotlin + Jetpack Compose) yang menggunakan `chat.deepseek.com` sebagai backend.

## ⚠️ Peringatan
Proyek ini menggunakan **API tidak resmi**. Penggunaan dapat melanggar ToS DeepSeek dan menyebabkan akun banned. Gunakan akun sekali pakai.

## Cara Build (GitHub Actions)
1. Push repo ke GitHub.
2. Buka tab **Actions** → **Build APK** → **Run workflow**.
3. Tunggu build selesai, download artifact `deepseek-native-debug`.

## Catatan Build
- Proyek **tidak menyertakan Gradle Wrapper** (`gradlew`). Workflow memakai
  `gradle/actions/setup-gradle@v4` dengan `gradle-version: 8.7`.
- Sejak Kotlin 2.0, Compose Compiler wajib diaktifkan via plugin
  `org.jetbrains.kotlin.plugin.compose` versi sama dengan Kotlin (2.0.20).
  Blok `composeOptions { kotlinCompilerExtensionVersion }` sudah tidak dipakai.

## Cara Kerja
- **Login**: WebView asli membuka `chat.deepseek.com` → hindari deteksi bot.
- **Chat**: UI native (Compose) → OkHttp → `/api/v0/chat/completion`.
- **PoW**: **Belum diimplementasikan penuh** (placeholder).

## Keterbatasan
- PoW solver **belum lengkap** — untuk chat berfungsi, PoW harus diselesaikan
  di dalam konteks WebView (bukan native).
- Token perlu di-refresh manual jika expired.
- Workflow hanya build **debug APK**.
