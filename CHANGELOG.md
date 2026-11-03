# Changelog

## [1.2.0] — 2026-11-03

### Diubah

- Output normal disederhanakan menjadi satu progress bar terpusat, pesan awal singkat, dan ringkasan akhir.
- Pembaruan progress dipicu oleh interval waktu atau kenaikan persentase (mana yang lebih dahulu), dengan jeda minimum dan batas default 100 pembaruan reguler per proses render.
- Terminal interaktif memperbarui satu baris menggunakan carriage return; GitHub Actions menggunakan baris periodik biasa tanpa ANSI escape sequence.
- Status 100% ditahan sampai FFmpeg berhasil keluar dan file MP4 parsial dipindahkan menjadi output final. Tahap menunggu encoder ditampilkan sebagai `Finalizing` pada 99%.
- Detail setup, scene, statistik render, dan progres mesin FFmpeg dipindahkan ke `LOG_LEVEL=verbose`.
- Output proses `npm install` otomatis tidak lagi diwariskan langsung ke console pada mode normal. Jika instalasi gagal, tail diagnostik stdout/stderr tetap disertakan.
- Benchmark memakai progress reporter yang sama sehingga tidak lagi mencetak satu baris progres setiap interval sendiri.
- GitHub Actions menambahkan input `log_level` (`quiet`, `normal`, `verbose`) dan environment konfigurasi progress.

### Konfigurasi baru

- `LOG_LEVEL=normal` (default), `quiet`, atau `verbose`.
- `PROGRESS_INTERVAL_MS=5000`.
- `PROGRESS_PERCENT_STEP=5`.
- `PROGRESS_MIN_INTERVAL_MS=1000`.
- `PROGRESS_MAX_UPDATES=100`.
- `PROGRESS_BAR_WIDTH=32`.

### Pengujian

- Lulus: format progress bar, clamp persentase, validasi konfigurasi logging.
- Lulus: pemicu pembaruan berbasis waktu/persentase dan pencegahan output duplikat menggunakan interval minimum.
- Lulus: perilaku satu baris terminal interaktif dan output non-interaktif GitHub Actions tanpa ANSI.
- Lulus: mode quiet menahan log biasa tetapi mempertahankan progress, ringkasan, dan error fatal.
- Lulus: simulasi 7.200 frame dengan durasi simulasi sangat lambat tetap dibatasi maksimal 102 baris progress per satu scene (termasuk initial, finalizing, dan final state), bukan satu baris per frame.
- Lulus: parsing protokol progres FFmpeg dan uji error exit non-zero dengan diagnostik stderr.
- Lulus: direct raw RGBA stdin tetap menghasilkan MP4 H.264 valid dan status final FFmpeg `progress=end` terbaca.
- Hasil suite di lingkungan kerja: 33 tes lulus, 1 tes foto dilewati karena PureImage tidak tersedia, 0 gagal.

### Batasan

- Benchmark performa rasterisasi 7.200 frame tidak dijalankan ulang untuk perubahan logging ini. Pembaruan hanya mengubah pelaporan console dan tidak mengubah visual rendering atau konfigurasi encoder.
- Uji simulasi 7.200 frame memverifikasi batas output logger, bukan waktu render video produksi.

---

Semua catatan perubahan ditulis berdasarkan perubahan kode dan pengujian yang benar-benar dilakukan. Waktu render atau persentase percepatan tidak dicantumkan tanpa hasil benchmark terukur.

## [1.1.0] — 2026-11-03

### Diubah

- Jalur video diganti dari PNG-per-frame (`PureImage.encodePNGToStream` → buffer PNG → FFmpeg `image2pipe`) menjadi raw RGBA (`canvas.data` → FFmpeg `rawvideo` melalui `stdin`).
- Buffer RGBA di-wrap dengan `Buffer.from(arrayBuffer, byteOffset, byteLength)` tanpa menyalin pixel buffer.
- Pengiriman frame dilakukan satu per satu dan menunggu callback stream sebelum canvas digunakan kembali. Ini memberi backpressure dan mencegah frame buffer mutable ditimpa ketika masih diproses oleh pipe.
- Output MP4 ditulis ke file sementara `.partial.mp4` dan dipindahkan ke nama final hanya setelah FFmpeg keluar dengan status sukses.
- Error FFmpeg, error pipe, proses spawn yang gagal, dan proses abort ditangani dengan pesan error serta pembersihan file sementara.
- Default encoder H.264 diubah dari preset `medium` menjadi `veryfast`, CRF tetap 18, pixel format tetap `yuv420p`, dan jumlah thread dapat dikonfigurasi. Preset lebih cepat dapat menghasilkan ukuran file berbeda pada kualitas CRF yang sama.
- Progress periodik menampilkan nama scene, frame, jumlah frame, persen, elapsed time, rata-rata FPS, ETA, serta progress encoding FFmpeg jika tersedia.
- Benchmark memisahkan pengukuran rasterisasi JavaScript dari encoding FFmpeg menggunakan raw sample yang sama. `--render-only` dapat digunakan tanpa membutuhkan FFmpeg dan tanpa menyimpan seluruh frame raw.

### Optimasi fixture `part-02-des.js`

- Fixture produksi asli disimpan di `benchmarks/fixtures/part-02-des.js` sebagai workload pengujian, tanpa mengubah dua demo di `content/`.
- Cache per-context diterapkan untuk gradient latar Matrix yang tidak bergantung waktu atau ukuran lain.
- Seed kolom hujan Matrix dicache berdasarkan jumlah kolom sehingga hash berbasis `Math.sin` tidak dihitung ulang pada setiap frame.
- Tokenisasi subtitle, word wrapping, lebar kata/baris, dan layout statis dicache berdasarkan dimensi canvas.
- Pencarian subtitle aktif dan scene timeline menggunakan binary search.
- Gradien hujan yang bergerak, karakter, proporsi, animasi, gestur, ekspresi, waktu subtitle, transisi, HUD, warna, dan elemen visual sumber tetap dipertahankan dalam fixture.

### Kompatibilitas

- Lifecycle `setup(params)`, `render(params)`, dan `dispose()` tetap didukung, termasuk handler async.
- Pencarian file JavaScript rekursif dan output subfolder tetap dipertahankan.
- Mode video dan foto, resolusi, rasio aspek, FPS, durasi, PNG, JPG, serta deteksi dependensi scene tetap didukung.
- GitHub Actions tetap hanya menggunakan trigger `workflow_dispatch`; batas waktu job kini dapat dipilih melalui input manual.
- Lisensi MIT yang sudah ada dipertahankan tanpa perubahan.

### Dokumentasi

- README diperbarui untuk arsitektur raw RGBA, konfigurasi FFmpeg, progress, benchmark, dan batas backend.
- `docs/PERFORMANCE-AUDIT.md` ditambahkan untuk menyimpan bukti source audit, estimasi volume data, prioritas bottleneck, keputusan arsitektur, dan batas verifikasi.
- Prosedur benchmark dan penggunaan fixture produksi didokumentasikan.

### Pengujian dan bukti

- Lulus: syntax check untuk engine dan fixture.
- Lulus: unit test konfigurasi dan discovery file JavaScript.
- Lulus: lifecycle sync/async, termasuk pemanggilan `dispose()` setelah render gagal.
- Lulus: pengambilan RGBA zero-copy dan validasi dimensi/ukuran buffer.
- Lulus: argumen FFmpeg rawvideo dan validasi preset/CRF/thread.
- Lulus: streaming dua frame raw RGBA melalui stdin FFmpeg dan validasi output MP4 H.264 menggunakan FFprobe.
- Lulus: input raw RGBA file ke FFmpeg serta verifikasi codec, dimensi, dan jumlah frame.
- Lulus: struktur fixture 11 scene dan export lifecycle.
- Lulus: 20 tes otomatis; 1 tes foto dilewati ketika modul PureImage tidak tersedia.
- Belum diverifikasi: render frame produksi dengan PureImage, pixel diff dengan baseline, benchmark 720p/1080p/60 FPS, dan benchmark 7.200 frame penuh.

### Batasan yang diketahui

- `npm install` tidak selesai di container kerja karena timeout jaringan, sehingga PureImage/esbuild tidak tersedia untuk menjalankan benchmark rasterisasi sebenarnya.
- Karena benchmark produksi belum dijalankan, tidak ada angka FPS produksi, speedup, durasi 240 detik, atau peak RSS render yang diklaim. Script benchmark mengukur peak RSS Node dan, pada Linux, peak RSS proses FFmpeg; penggunaan CPU yang dilaporkan hanya milik Node.
- PureImage tetap menjadi backend Canvas murni JavaScript untuk mempertahankan kompatibilitas, tetapi dokumentasi upstream menyatakan prioritasnya adalah portabilitas dan kesederhanaan, bukan kecepatan. Raw RGBA menghapus overhead PNG per frame tetapi belum membuktikan rasterisasi PureImage dapat memenuhi batas waktu GitHub Actions.
- Kesetaraan visual pixel-perfect belum terverifikasi dengan screenshot/frame diff. Optimasi cache hanya memindahkan perhitungan yang secara kode tidak bergantung pada waktu; validasi visual otomatis masih perlu dilakukan pada lingkungan yang memiliki dependensi.
