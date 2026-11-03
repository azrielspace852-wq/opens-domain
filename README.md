## 📄 License

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

This project is licensed under the **MIT License** — see the [LICENSE](LICENSE) file for details.

Copyright (c) 2025 **AXION Neuralis**

# GitHub JavaScript Content Renderer

Tool untuk merender seluruh scene JavaScript di `content/` menjadi video MP4 atau gambar PNG/JPG melalui GitHub Actions. Workflow hanya berjalan ketika pengguna menekan **Actions → Render JavaScript Content → Run workflow**.

> **Batas dukungan yang wajib dipahami:** setiap file scene harus berupa JavaScript `.js` dan wajib menyediakan fungsi `render`. Tool ini tidak menjalankan Chromium, Puppeteer, Playwright, HTML, CSS, JSX, TS, atau TSX. Renderer berjalan di Node.js menggunakan PureImage (Canvas 2D murni JavaScript) dan FFmpeg.

## Fitur

- Memindai `content/` secara rekursif dan menemukan semua file dengan ekstensi `.js`.
- Setiap file `.js` menjadi satu scene dan menghasilkan satu file output.
- Mode video MP4: 10, 20, 30, atau 60 FPS; 360p, 480p, 720p, 1080p, atau 2160p; rasio 16:9, 9:16, atau 1:1; durasi detik dapat berupa bilangan bulat atau desimal.
- Mode foto: PNG atau JPG; rasio 16:9, 9:16, atau 1:1; target 12, 24, 48, atau 108 MP.
- Mode video memakai raw RGBA langsung ke stdin FFmpeg; tidak membuat PNG sementara untuk setiap frame.
- Frame dialirkan satu per satu dengan backpressure dan satu buffer Canvas yang dipakai ulang.
- Progres menampilkan file scene, frame, persentase, waktu berjalan, FPS rata-rata, dan ETA.
- Preset encoder H.264 dan CRF dapat diatur dari workflow.
- Benchmark menyediakan pengukuran terpisah untuk waktu render JavaScript dan waktu encoding FFmpeg.
- Mendeteksi import/require paket npm pihak ketiga dari scene dan modul JavaScript lokalnya, lalu memasang paket yang belum tersedia sebelum render.
- Menyimpan hasil di `output/` dan mengunggahnya sebagai GitHub Actions artifact.
- Tidak menjalankan workflow dari `push` atau `pull_request`.
- Lisensi proyek: MIT (lihat `LICENSE`).

## Struktur repository

```text
video-renderer/
├── .github/
│   └── workflows/
│       └── render.yml
├── content/
│   ├── animated-gradient.js
│   └── simple-poster.js
├── scripts/
│   ├── lib/
│   │   ├── config.mjs
│   │   ├── ffmpeg.mjs
│   │   ├── raw-frame.mjs
│   │   └── render-frames.mjs
│   ├── benchmark.mjs
│   └── render.mjs
├── benchmarks/
│   ├── fixtures/
│   │   └── part-02-des.js
│   └── results/                 # laporan benchmark, tidak dikomit
├── tests/
│   ├── config.test.mjs
│   ├── ffmpeg.test.mjs
│   ├── part02-content.test.mjs
│   ├── photo-encoding.test.mjs
│   ├── raw-frame.test.mjs
│   └── render-frames.test.mjs
├── docs/
│   └── PERFORMANCE-AUDIT.md
├── CHANGELOG.md
├── .gitignore
├── LICENSE
├── package.json
└── README.md
```

Folder `.render-cache/` dibuat saat workflow berjalan untuk menyimpan bundle sementara. Folder `output/` dibuat untuk hasil render. Keduanya diabaikan oleh Git.

## 1. Instalasi

1. Buat repository GitHub atau ekstrak proyek ini ke repository yang sudah ada.
2. Pertahankan folder `.github/workflows/`, `scripts/`, dan file konfigurasi di root.
3. Letakkan scene JavaScript di `content/`.
4. Commit dan push repository ke GitHub.
5. Buka tab **Actions**, pilih **Render JavaScript Content**, lalu tekan **Run workflow**.
6. Pilih mode dan parameter render, kemudian tekan **Run workflow**.
7. Setelah job selesai, buka ringkasan workflow dan unduh artifact `rendered-video-*` atau `rendered-photo-*`.

Workflow menggunakan runner Ubuntu GitHub-hosted, Node.js 22, npm, dan FFmpeg. Dependensi inti proyek diinstal otomatis oleh workflow. FFmpeg dipasang melalui `apt` sebelum proses render.

### Menjalankan secara lokal (opsional)

Persyaratan lokal: Node.js 22+, npm, dan FFmpeg tersedia di `PATH` untuk mode video.

```bash
npm install
npm test

# Video 1080p, 30 FPS, 8 detik, 16:9
npm run render -- --mode video --fps 30 --video-resolution 1080p --aspect-ratio 16:9 --duration 8

# Foto JPG 48 MP, rasio 9:16
npm run render -- --mode photo --image-resolution 48MP --image-format JPG --aspect-ratio 9:16
```

Dependensi npm yang dipakai scene akan dideteksi dan dipasang ketika `npm run render` dijalankan. Instalasi paket tambahan membutuhkan koneksi internet ke registry npm.

## 2. Menulis file scene di `content/`

Setiap file `.js` adalah satu scene mandiri. Renderer menerima dua bentuk export berikut.

### A. Named export (disarankan)

```js
export async function setup({ width, height }) {
  // Dipanggil satu kali sebelum frame pertama.
  return { centerX: width / 2, centerY: height / 2 };
}

export async function render({ ctx, width, height, time, frame, progress, state }) {
  ctx.fillStyle = '#14213d';
  ctx.fillRect(0, 0, width, height);

  ctx.fillStyle = '#fca311';
  ctx.beginPath();
  ctx.arc(
    state.centerX + Math.sin(time * 2) * width * 0.1,
    state.centerY,
    Math.min(width, height) * 0.08,
    0,
    Math.PI * 2,
  );
  ctx.fill();
}

export async function dispose({ state }) {
  // Opsional: bersihkan resource setelah render selesai.
}
```

### B. Default export berupa object

```js
export default {
  render({ ctx, width, height }) {
    ctx.fillStyle = '#101820';
    ctx.fillRect(0, 0, width, height);
  },
};
```

Default export berupa fungsi juga didukung:

```js
export default function render({ ctx, width, height }) {
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, width, height);
}
```

### Parameter yang diterima fungsi `render`

| Properti | Isi |
|---|---|
| `canvas` | Objek image/canvas PureImage untuk scene tersebut. |
| `ctx` | Context `2d` yang digunakan untuk menggambar. |
| `width`, `height` | Ukuran output dalam pixel. |
| `mode` | `video` atau `photo`. |
| `fps` | FPS video; `null` pada mode foto. |
| `frame` | Nomor frame dimulai dari `0`; selalu `0` pada mode foto. |
| `totalFrames` | Jumlah frame video; `1` pada mode foto. |
| `time` | Waktu frame dalam detik (`frame / fps`); `0` pada mode foto. |
| `duration` | Durasi pilihan workflow dalam detik; `0` pada mode foto. |
| `progress` | Progres frame dari `0` sampai `1`. Pada foto nilainya `1`. |
| `aspectRatio` | Rasio pilihan: `16:9`, `9:16`, atau `1:1`. |
| `contentFile` | Path absolut file scene `.js` yang sedang dirender. |
| `contentDirectory` | Folder asal file scene. Gunakan ini untuk membangun path asset/font. |
| `state` | Nilai yang dikembalikan oleh `setup()`. |

`setup()` dan `dispose()` bersifat opsional. `setup()` dipanggil satu kali untuk satu scene dan hasilnya diteruskan sebagai `state` pada setiap frame. `dispose()` dipanggil setelah scene selesai atau mengalami kegagalan. Fungsi `render()` wajib ada dan boleh mengembalikan Promise.

**Penting:** renderer mengosongkan area gambar sebelum setiap pemanggilan `render()`. Jangan mengandalkan isi frame sebelumnya. Set warna, font, transformasi, dan properti context yang dibutuhkan pada setiap frame. Gunakan `ctx.save()` dan `ctx.restore()` untuk menjaga perubahan state context di dalam kode scene.

### Membaca asset lokal dan menggunakan font

Bundle sementara dibuat di `.render-cache/`, sehingga jangan memakai `import.meta.url` untuk mencari asset relatif ke file scene. Gunakan `contentFile` atau `contentDirectory` yang diberikan renderer.

Contoh memuat font TrueType dengan PureImage:

```js
import * as PImage from 'pureimage';
import path from 'node:path';

export async function setup({ contentDirectory }) {
  const fontPath = path.join(contentDirectory, 'fonts', 'OpenSans-Regular.ttf');
  const font = PImage.registerFont(fontPath, 'Open Sans');
  await font.load();
  return { fontFamily: 'Open Sans' };
}

export function render({ ctx, width, height, state }) {
  ctx.fillStyle = '#111827';
  ctx.fillRect(0, 0, width, height);
  ctx.fillStyle = '#ffffff';
  ctx.font = `48pt '${state.fontFamily}'`;
  ctx.textAlign = 'center';
  ctx.fillText('Hello Canvas', width / 2, height / 2);
}
```

File font dan asset boleh disimpan dalam subfolder `content/`, tetapi hanya `.js` yang dipindai sebagai scene mandiri. File asset tidak akan dirender menjadi output terpisah.

## 3. Opsi render

Parameter berikut disediakan sebagai input pada halaman **Run workflow**.

### Mode video

| Opsi | Pilihan |
|---|---|
| Format | MP4 saja |
| FPS | 10, 20, 30, 60 |
| Resolusi | 360p, 480p, 720p, 1080p, 2160p |
| Rasio aspek | 16:9, 9:16, 1:1 |
| Durasi | Angka positif dalam detik, boleh desimal |
| Codec video | H.264 (`libx264`) |
| Preset default | `veryfast` |
| CRF default | `18` |
| Thread | Otomatis (`0`) |
| Pixel format | `yuv420p` |

Label resolusi memakai sisi pendek sebagai nilai `p`: misalnya 1080p 16:9 menghasilkan 1920×1080, sedangkan 1080p 9:16 menghasilkan 1080×1920. Dimensi video disesuaikan ke bilangan genap agar kompatibel dengan encoder H.264 `yuv420p`.

Jumlah frame dihitung dengan `ceil(durasi × FPS)`. Karena frame harus berupa bilangan bulat, durasi hasil akhir dapat lebih panjang kurang dari satu interval frame dibanding nilai input.

### Mode foto

| Opsi | Pilihan |
|---|---|
| Format | PNG atau JPG |
| Resolusi target | 12 MP, 24 MP, 48 MP, 108 MP |
| Rasio aspek | 16:9, 9:16, 1:1 |

Megapixel merupakan target jumlah pixel. Lebar dan tinggi dibulatkan ke bilangan pixel utuh sehingga jumlah akhir dapat sedikit berbeda dari target. Mode foto hanya menghasilkan satu gambar per file scene. Input FPS, resolusi video, dan durasi tidak digunakan dalam mode foto; input resolusi foto dan format gambar tidak digunakan dalam mode video.

## 4. Auto-install dependensi npm

Sebelum render, tool menjalankan proses berikut:

1. Membaca seluruh scene `.js` yang ditemukan.
2. Mem-parse graph import/require menggunakan esbuild dengan package pihak ketiga dibiarkan sebagai external import.
3. Mengumpulkan nama paket dari import statis, dynamic import dengan specifier string literal, dan `require()` dengan nama paket string literal, termasuk import dari modul `.js` lokal yang ikut dibundle.
4. Mengabaikan modul bawaan Node.js seperti `node:fs`, `path`, dan `crypto`.
5. Memeriksa apakah paket sudah dapat di-resolve dari repository.
6. Menjalankan `npm install --no-save --no-package-lock --no-audit --no-fund ...` untuk paket yang belum tersedia.
7. Baru setelah itu menyusun bundle sementara dan memuat scene untuk dirender.

Contoh yang dideteksi:

```js
import dayjs from 'dayjs';
import { nanoid } from 'nanoid';
const lodash = require('lodash');
const plugin = await import('some-plugin');
```

Paket di atas akan dipasang otomatis saat belum tersedia. Gunakan `import` untuk dependency ESM-only dan `require()` untuk paket CommonJS yang kompatibel. Pemanggilan `require(variable)`, `import(variable)`, nama paket yang dibentuk saat runtime, alias import `#...`, dan dependency yang dimuat oleh mekanisme khusus di luar graph import statis **tidak dapat dijamin terdeteksi**. Untuk memastikan instalasi otomatis, nama paket wajib ditulis sebagai string literal pada `import`, dynamic `import('nama-paket')`, atau `require('nama-paket')`.

Versi dependensi tambahan mengikuti versi yang dipilih npm saat workflow berjalan karena instalasi otomatis tidak menyimpan dependency tambahan ke `package.json` atau `package-lock.json`. Untuk build yang sepenuhnya reproducible, pin versi paket secara eksplisit pada konfigurasi package manager di proyek Anda dan sesuaikan kebijakan instalasi ini.

## 5. Format dan aturan folder `content/`

- Hanya file dengan ekstensi `.js` huruf kecil yang diproses sebagai scene.
- Pemindaian berjalan rekursif, termasuk subfolder.
- `.ts`, `.tsx`, `.jsx`, `.mjs`, `.cjs`, `.json`, `.html`, `.css`, dan file lain tidak diproses sebagai scene.
- Setiap scene wajib mempunyai `render` berupa function.
- Import lokal yang ikut dibundle sebaiknya berupa modul `.js`. Letakkan helper `.js` di luar `content/` (misalnya `lib/`), karena **setiap** `.js` di dalam `content/` juga dianggap scene dan harus memiliki fungsi `render`. TypeScript/JSX tidak termasuk target dukungan proyek ini.
- Jangan memasukkan file output, `node_modules`, atau source yang tidak dipercaya ke folder scene.
- File JS dijalankan sebagai kode Node.js di runner GitHub. Kode scene bukan sandbox dan dapat mengakses filesystem, environment, proses, serta jaringan yang tersedia untuk job.

Contoh:

```text
content/
├── intro.js                 # menghasilkan intro.mp4 / intro.png
├── outro.js                 # menghasilkan outro.mp4 / outro.png
└── campaign/
    ├── poster.js            # menghasilkan campaign/poster.mp4 / .png
    └── assets/
        └── logo.png         # asset, bukan scene
```

Nama subfolder dipertahankan pada `output/`. Output video memakai `.mp4`; output foto memakai `.png` atau `.jpg` sesuai pilihan workflow.

## 6. Canvas API yang didukung dan batasan wajib

Renderer memakai **PureImage**, implementasi Canvas 2D untuk Node.js yang ditulis dengan JavaScript murni dan tidak membutuhkan Chromium atau native Canvas binding. Dukungan Canvas tidak identik dengan seluruh implementasi browser.

Operasi yang disiapkan/umumnya didukung oleh backend ini antara lain:

- `canvas.getContext('2d')`;
- `fillRect`, `strokeRect`, `clearRect`;
- path dasar seperti `beginPath`, `closePath`, `moveTo`, `lineTo`, `arc`, `quadraticCurveTo`, `bezierCurveTo`, `fill`, dan `stroke`;
- `fillStyle`, `strokeStyle`, warna CSS dasar dan `rgba()`;
- alpha compositing dasar, transformasi, dan clipping dasar;
- `createLinearGradient` dan `createRadialGradient`;
- `drawImage` untuk image yang sudah dibaca melalui API PureImage;
- teks dasar melalui font yang diregistrasi menggunakan `PImage.registerFont()`.

**Batasan berikut WAJIB dipatuhi, bukan opsional:**

1. Jangan menganggap semua Web Canvas API tersedia. Fitur browser-only, DOM, `window`, `document`, WebGL, WebGPU, WebAudio, CSS layout, CSS filter, dan API browser lain tidak tersedia.
2. Gunakan hanya Canvas 2D yang didukung PureImage. Fitur yang tidak didukung dapat menghasilkan error atau gambar yang berbeda dari browser.
3. Font TrueType/OpenType harus diregistrasi dan dimuat sebelum digunakan. PureImage menyediakan teks dasar; bold/italic tidak didukung seperti pada browser. Jangan mengasumsikan font web atau font browser tersedia otomatis.
4. Operasi image/font harus memakai API Node/PureImage dan file lokal yang path-nya dibangun dari `contentDirectory`/`contentFile` atau path repository yang diketahui.
5. Scene wajib mengekspor fungsi `render`. `setup` dan `dispose` opsional.
6. Jangan bergantung pada state context dari frame sebelumnya; renderer membersihkan canvas sebelum setiap render frame.
7. Seluruh proses harus bisa berjalan tanpa Chromium, browser GUI, Puppeteer, atau Playwright.
8. Import dependency pihak ketiga yang ingin di-auto-install harus menggunakan specifier string literal agar bisa dideteksi.
9. FFmpeg harus tersedia di PATH untuk mode video. Workflow memasangnya otomatis; untuk penggunaan lokal, pengguna memasangnya sendiri.
10. PureImage memprioritaskan portabilitas dan implementasi JavaScript dibanding kecepatan. Render 48 MP/108 MP dan video panjang/4K/60 FPS dapat memakan waktu dan memori yang besar. Batas waktu GitHub Actions dan kapasitas runner tetap berlaku.

## 7. Output dan GitHub Actions

Hasil render dibuat pada `output/`, lalu diunggah sebagai artifact oleh `actions/upload-artifact@v4` dengan masa simpan 14 hari. Jika render gagal setelah sebagian file selesai, artifact dari file yang sudah terbentuk tetap dicoba diunggah.

Input workflow juga menyediakan preset H.264, CRF, dan `timeout_minutes` (30–360 menit). Timeout bukan optimasi performa; nilai tersebut hanya mengatur batas job. Default encoder `veryfast` mempertahankan CRF 18, tetapi biasanya menghasilkan file lebih besar daripada preset `medium` untuk kualitas perceptual yang sebanding. Gunakan `fast` atau `medium` bila ukuran file lebih penting daripada waktu encoding. CRF lebih rendah menaikkan kualitas dan ukuran file; CRF lebih tinggi menurunkan keduanya.

Workflow hanya memiliki trigger `workflow_dispatch`. Tidak ada trigger `push`, `pull_request`, schedule, atau trigger otomatis lainnya. Jalankan dari tab Actions secara manual.

Permission job dibatasi ke `contents: read`. Script scene tetap berjalan dengan hak proses runner, sehingga repository dan dependency harus berasal dari sumber yang dipercaya. Jangan menyimpan secret yang tidak diperlukan dalam workflow; jangan memasukkan kode scene atau dependency yang tidak dipercaya.

## 8. Pengujian

Jalankan unit test konfigurasi dan pemindaian folder dengan:

```bash
npm test
```

Pengujian ini mencakup dimensi, parsing opsi, normalisasi nama paket, dan pemindaian file `.js`. Pengujian unit tidak menggantikan uji render end-to-end pada runner GitHub yang memiliki FFmpeg dan dependency npm terpasang.

## 9. Lisensi

Proyek ini menggunakan **MIT License**. Lihat file `LICENSE` untuk teks lisensi lengkap.


## 10. Arsitektur video raw RGBA

Pipeline video sekarang menggunakan urutan berikut:

```text
Scene JavaScript
  -> PureImage Canvas 2D
  -> canvas.data (RGBA Uint8Array)
  -> Buffer view tanpa salinan
  -> child_process stdin (rawvideo / rgba)
  -> FFmpeg libx264
  -> MP4 sementara (.partial.mp4)
  -> rename atomik menjadi output MP4
```

PureImage 0.4.x menyimpan bitmap dalam `canvas.data` sebagai byte RGBA berurutan. Renderer membuat `Buffer` view terhadap ArrayBuffer yang sama; tidak ada `Buffer.from(data)` yang menyalin seluruh pixel. Buffer itu dikirim satu frame pada satu waktu ke FFmpeg dengan format `rawvideo`, `pixel_format=rgba`, dan ukuran frame yang eksplisit.

Untuk satu frame 1920×1080, ukuran raw RGBA adalah 8.294.400 byte (sekitar 7,91 MiB). Untuk 7.200 frame, total aliran pixel mentah setara sekitar 55,6 GiB. Itu adalah volume data yang lewat sepanjang pipeline, bukan kebutuhan RAM: renderer tidak menampung seluruh frame. Canvas dan buffer frame digunakan ulang; callback penulisan ditunggu sebelum frame berikutnya mengganti isi buffer.

Jalur lama mengodekan setiap frame sebagai PNG ke `PassThrough`, mengumpulkan chunk, membuat `Buffer.concat`, lalu memberikan PNG melalui `image2pipe` agar FFmpeg mendekodenya kembali. Jalur baru menghapus dua tahap PNG per frame dan alokasi penampung PNG. Ini menghilangkan pekerjaan yang tidak diperlukan pada perpindahan frame, tetapi tidak membuat proses gambar di Canvas menjadi lebih cepat dengan sendirinya.

Frame ditulis berurutan. Callback `Writable` dipakai untuk mengendalikan backpressure dan memastikan buffer yang sama tidak dimodifikasi sebelum Node selesai mengirimkan chunk ke pipe. Pada kegagalan, stdin dihentikan, proses FFmpeg dihentikan dengan SIGTERM lalu SIGKILL sebagai fallback, dan file parsial dihapus. Output akhir hanya dipublikasikan setelah FFmpeg selesai dengan exit code 0.

## 11. Pengaturan FFmpeg

Input video adalah raw RGBA; output menggunakan `libx264`, `yuv420p`, `+faststart`, tanpa audio (seperti perilaku renderer sebelumnya). Default sekarang `preset=veryfast`, `CRF=18`, dan `threads=0` (FFmpeg memilih jumlah thread). Pilihan preset yang diterima: `ultrafast`, `superfast`, `veryfast`, `faster`, `fast`, dan `medium`.

- Preset lebih cepat mengurangi biaya encoding dan biasanya menghasilkan file lebih besar pada CRF yang sama.
- CRF lebih rendah berarti kualitas/bitrate lebih tinggi; CRF lebih tinggi berarti kompresi lebih agresif.
- `yuv420p` dipertahankan untuk kompatibilitas pemutar video yang luas.
- `+faststart` memindahkan metadata MP4 untuk playback/progressive download lebih cepat.
- `threads=0` menyerahkan pemilihan thread kepada FFmpeg. Memaksa thread lebih tinggi tidak selalu mempercepat runner yang jumlah core-nya terbatas.

Opsi lokal melalui environment: `FFMPEG_PRESET`, `FFMPEG_CRF`, `FFMPEG_THREADS`; atau CLI `--ffmpeg-preset`, `--ffmpeg-crf`, `--ffmpeg-threads`.

## 12. Audit bottleneck dan batas backend

Audit kode awal menemukan beberapa biaya struktural. Lihat rincian, prioritas, dan batas hasil di [`docs/PERFORMANCE-AUDIT.md`](docs/PERFORMANCE-AUDIT.md).

Pada scene produksi `part-02-des.js`, versi fixture yang disertakan tetap memiliki 11 scene, karakter prosedural, gerakan, subtitle, HUD, transisi, dan latar Matrix. Perubahan optimasi fixture:

- Gradien dasar dan vignette yang koordinat/stop warnanya statis disimpan per context dan ukuran canvas.
- Nilai hash kolom hujan Matrix (berbasis `Math.sin`) dipraproses sekali per jumlah kolom.
- Token, pemenggalan kata, lebar teks perkiraan, baris subtitle, dan lebar setiap baris dicache berdasarkan resolusi.
- Pencarian timeline 11 scene diubah dari pemindaian linear menjadi binary search.

Gradien hujan Matrix yang koordinatnya bergerak per frame tidak dicache karena akan mengubah posisi/fade visual. Tidak ada karakter, scene, gestur, timing, palet, teks, atau efek yang dihapus.

PureImage tetap digunakan karena merupakan backend Canvas 2D murni JavaScript yang sesuai batas proyek (tanpa browser dan tanpa native Canvas binding). Namun dokumentasi resminya menjelaskan bahwa library mengutamakan portabilitas dan kesederhanaan, bukan performa maksimum. Karena itu, raw RGBA menghilangkan overhead pipeline tetapi belum membuktikan bahwa PureImage sanggup memenuhi target 7.200 frame pada batas waktu Actions. Tidak ada klaim durasi render atau speedup sebelum benchmark nyata dijalankan.

Worker Threads tidak diaktifkan secara default. Satu scene menggambar ke satu context mutable, dan state scene dapat berubah lintas frame; memparalelkan frame tanpa kontrak scene yang deterministik dapat merusak urutan visual. Worker juga membutuhkan bitmap terpisah per worker dan dapat meningkatkan konsumsi RAM serta kontensi CPU. Pendekatan aman saat ini adalah render serial dengan transfer frame yang dibatasi backpressure.

## 13. Benchmark independen

Jalankan dari root repository setelah `npm install`:

```bash
# Sampel 3 detik di bagian timeline 65 detik, 720p 30 FPS:
npm run benchmark -- --file benchmarks/fixtures/part-02-des.js --resolution 720p --fps 30 --duration 3 --start-time 65

# Sampel 2 detik 1080p 30 FPS:
npm run benchmark -- --resolution 1080p --fps 30 --duration 2 --start-time 65

# Render-only untuk mengukur rasterisasi pada klip penuh tanpa menyimpan raw frame:
npm run benchmark -- --resolution 1080p --fps 30 --duration 240 --render-only

# Encoding terpisah untuk sampel 1080p yang lebih besar (perhatikan penggunaan disk):
npm run benchmark -- --resolution 1080p --fps 30 --duration 3 --start-time 65 --max-raw-gb 1.5
```

Dalam mode benchmark penuh (bukan `--render-only`), script membuat file RGBA sementara dengan batas ukuran dan pemeriksaan ruang disk. Ia mengukur `javascriptRenderMs` selama reset Canvas + `render(params)`, waktu menulis raw sample, lalu menjalankan FFmpeg secara terpisah dari file RGBA yang sama untuk mendapatkan `ffmpegEncodeMs`. File sementara dihapus secara default; laporan JSON disimpan di `benchmarks/results/`. `--keep-raw` dan `--keep-output` hanya disediakan untuk diagnosis manual.

Benchmark sample dan benchmark full render-only menguji aspek berbeda. Contoh 3 detik tidak boleh diekstrapolasi sebagai jaminan linear untuk 240 detik. Full benchmark 1080p/30 FPS menyimpan sekitar 55,6 GiB raw RGBA jika encoding ingin dipisahkan, sehingga mode tersebut membutuhkan ruang disk yang sangat besar. Gunakan `--render-only` untuk pengukuran rasterisasi 7.200 frame tanpa membuat file sebesar itu.

Laporan memuat waktu render JavaScript, FPS render, waktu spool, waktu encoder, wall time, penggunaan CPU proses Node, peak RSS Node, serta peak RSS proses FFmpeg pada Linux (dibaca dari `/proc`). Pengukuran CPU pada versi ini hanya mencakup proses Node; CPU FFmpeg belum dipisahkan. Benchmark tidak otomatis mengubah target resolution/FPS/duration. Jangan menurunkan kualitas output untuk menyamarkan bottleneck.

## 14. Pengujian dan status verifikasi

```bash
npm run check
npm test
```

Suite mencakup konfigurasi, pemindaian `.js`, kompatibilitas lifecycle, verifikasi buffer RGBA zero-copy, validasi argumen FFmpeg, uji FFmpeg direct-stdin, MP4 H.264 dengan `ffprobe`, dan validasi struktur fixture `part-02-des.js`. Tes PNG/JPG PureImage berjalan bila dependensi `pureimage` tersedia.

Status pengujian saat paket ini disiapkan: 20 tes lulus, 1 tes foto dilewati karena paket PureImage tidak dapat diunduh/dipasang di container kerja. Uji direct raw stdin dan MP4 H.264 berhasil di lingkungan ini. File fixture lolos pemeriksaan syntax dan masih memiliki 11 scene serta seluruh export lifecycle. Pengujian render visual penuh dan perbandingan pixel/frame terhadap baseline belum dapat dilakukan di container ini; karena itu kesetaraan visual belum diklaim sebagai terverifikasi secara pixel-identik.

## 15. Riwayat perubahan

Lihat [`CHANGELOG.md`](CHANGELOG.md) untuk rincian perubahan, hasil tes, benchmark yang tersedia, dan batas verifikasi.
