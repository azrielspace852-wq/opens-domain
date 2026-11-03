# Audit Performa — GitHub Content Renderer

Tanggal audit: 3 November 2026  
Beban utama: satu file JavaScript, durasi 240 detik, 1920×1080, 30 FPS, 7.200 frame, MP4 H.264, GitHub Actions.

## Ringkasan temuan

Kegagalan historis (lebih dari enam jam dan akhirnya timeout) tidak disertai log. Karena itu penyebab tunggal dan proporsi waktunya tidak dapat ditetapkan dari bukti runtime. Audit ini menggunakan source ZIP dan file `part-02-des.js`. Kesimpulan di bawah membedakan fakta kode, perhitungan deterministik, dan hipotesis performa yang masih memerlukan benchmark.

Perubahan terbesar pada jalur data adalah menghilangkan PNG per frame. Pada implementasi lama, setiap frame diproses oleh `PureImage.encodePNGToStream`, ditampung dalam array chunk `PassThrough`, digabung menjadi buffer baru melalui `Buffer.concat`, lalu dikirim sebagai `image2pipe`/PNG ke FFmpeg untuk didekode lagi. Pekerjaan PNG tersebut terjadi 7.200 kali dalam workload utama.

Engine baru mengambil `canvas.data` RGBA secara langsung dan membungkus ArrayBuffer yang sama dengan `Buffer.from(arrayBuffer, byteOffset, byteLength)`. FFmpeg menerima `rawvideo`/`rgba` dari stdin. Tidak ada PNG per frame, PNG decoder FFmpeg, maupun penumpukan frame di RAM. Penulisan menunggu callback `Writable`, sehingga frame buffer tidak ditimpa ketika masih digunakan pipe.

## Bukti dan prioritas bottleneck

| Prioritas | Area | Bukti pada source awal | Dampak / status |
|---|---|---|---|
| P0 | Pipeline PNG | `encodePngBuffer()` memakai `PassThrough`, array chunk, `Buffer.concat`; input FFmpeg berupa `image2pipe` + `png` | Biaya codec dan alokasi tambahan untuk setiap frame. Dihilangkan dengan raw RGBA. |
| P0 | Rasterisasi PureImage | Scene memakai path, arc, quadratic curves, stroke/fill, teks, alpha compositing, dan gradient berulang. PureImage sendiri menyatakan desainnya tidak mengejar performa maksimum. | Kandidat bottleneck utama setelah PNG dihapus; belum bisa dipastikan sebagai komponen termahal tanpa benchmark. |
| P1 | Matrix background | Dengan F=1 (1080p landscape), lebar kolom 34 px menghasilkan 57 kolom. Tiap frame membuat satu gradient linear per kolom, plus gradien dasar dan vignette yang sebelumnya juga dibuat ulang. | Sekitar 410.400 dynamic gradient rain dibuat selama 7.200 frame, sedangkan dua gradient statis telah dicache pada fixture. Gradient dinamis sengaja tetap dibuat karena koordinatnya berubah setiap frame. |
| P1 | Seed hujan Matrix | Setiap kolom menghitung `hash(i)`, `hash(i+7)`, `hash(i+3)`; `hash()` menjalankan `Math.sin`. | 57 × 3 × 7.200 = 1.231.200 pemanggilan hash/sinus terhindarkan setelah seed dicache untuk jumlah kolom. |
| P1 | Subtitle | Tiap frame subtitle aktif ditokenisasi, dipisah menjadi kata, dihitung ulang lebar estimasi dan line wrapping-nya. | Token dan layout statis dicache per dimensi canvas; posisi/alpha tetap dihitung/digambar sesuai waktu. |
| P2 | Timeline | Pencarian scene awal memeriksa `SCENES` dari awal untuk setiap frame (maksimum 11 item). | Diganti binary search. Penghematan kecil dibanding rasterisasi dan PNG, tetapi deterministik. |
| P2 | Alokasi per frame | Objek context frame dibentuk untuk setiap render dan pemanggilan fungsi render dibuat melalui `await` meski hasilnya sinkron. | Engine baru menghindari Promise tambahan untuk render sinkron. Satu context parameter per frame tetap diperlukan untuk kompatibilitas API. |
| P2 | FFmpeg settings | Preset lama `medium`, CRF 18, input PNG. | Sekarang `veryfast` default dengan CRF 18; pixel format yuv420p dan H.264 dipertahankan. Preset mengubah efisiensi kompresi/ukuran, bukan jumlah operasi Canvas. |

## Perhitungan data raw

Ukuran frame raw RGBA dihitung sebagai `width × height × 4`:

- 1920 × 1080 × 4 = 8.294.400 byte/frame (sekitar 7,91 MiB).
- 7.200 frame × 8.294.400 byte = 59.719.680.000 byte (sekitar 55,6 GiB) sepanjang stream.

Angka 55,6 GiB adalah volume transfer untuk keseluruhan video, bukan buffer RAM yang dialokasikan sekaligus. Implementasi baru memproses satu frame pada satu waktu dan menggunakan bitmap yang sama. Satu frame masih memerlukan sekitar 7,91 MiB untuk data pixel, selain working memory PureImage, teks, jalur, proses Node dan FFmpeg.

## PureImage dan kesimpulan backend

PureImage menyediakan pixel byte pada `canvas.data` sebagai `Uint8Array` berurutan RGBA. Ini memungkinkan jalur direct raw video tanpa membuat format perantara. Namun dokumentasi resmi proyek menjelaskan bahwa PureImage menempatkan portabilitas dan kesederhanaan di atas kecepatan, serta secara eksplisit mengatakan implementasinya tidak ditujukan untuk performa maksimum: <https://github.com/joshmarinacci/node-pureimage#why

Dengan batasan tanpa Chromium dan tanpa native Canvas binding, PureImage dipertahankan demi kompatibilitas JavaScript murni. Tidak ada alternatif backend murni JavaScript yang berhasil diuji terhadap Canvas API dari fixture ini dalam lingkungan ini. Karena tidak ada render benchmark lokal yang berjalan, belum ada bukti bahwa penghapusan PNG cukup untuk mencapai batas waktu GitHub Actions. Jika `javascriptRenderFps` pada benchmark tetap sangat rendah, pekerjaan berikutnya harus mengevaluasi rasterizer JavaScript lain atau pengurangan kompleksitas internal yang terbukti pixel-equivalent; bukan mengklaim FFmpeg sebagai satu-satunya penyebab.

## Alasan tidak mengaktifkan Worker Threads

Frame memakai context Canvas yang mutable dan konten dapat menyimpan state pada module-level atau `state` hasil `setup()`. Mengirim frame yang sama ke banyak worker tidak aman. Setiap worker yang memiliki canvas sendiri juga menambah bitmap sekitar 7,91 MiB pada 1080p, di luar heap dan font cache, dan dapat menyebabkan kontensi CPU pada runner terbatas. Karena tidak tersedia benchmark multi-worker dan tidak ada kontrak bahwa setiap scene bersifat stateless/deterministik lintas frame, worker paralel tidak diaktifkan.

## Validasi visual

Fixture `benchmarks/fixtures/part-02-des.js` menjaga 11 entry scene dan export `setup`, `render`, `dispose`. Perubahan pada fixture hanya memindahkan kerja yang tidak berubah antar-frame ke cache:

- Gradient dasar dan vignette statis dibuat sekali per context/ukuran.
- Nilai seed Matrix bergantung hanya pada index dan dicache.
- Token, wrapping, dan lebar baris subtitle bergantung pada teks dan resolusi, bukan waktu; nilai tersebut dicache. Alpha, scene aktif, dan posisi y tetap dihitung per frame.
- Pemilihan scene memakai pencarian biner pada batas start yang sudah terurut.

Gradient hujan yang koordinatnya bergerak, animasi karakter, gestur, ekspresi, bentuk, transisi, HUD, warna, dan subtitle time range tidak dihapus. Namun tidak dilakukan screenshot comparison/pixel diff karena paket PureImage gagal dipasang di container; jadi visual equality pixel-perfect belum dapat diklaim.

## Status pengujian pada container kerja

- Node.js: 22.16.0.
- FFmpeg: tersedia (7.1.5); FFprobe tersedia.
- Tes otomatis: 20 lulus, 1 dilewati (uji encode PNG/JPG PureImage memerlukan dependency `pureimage`).
- Direct raw RGBA stdin → FFmpeg → MP4 H.264: lulus pada tes dua frame kecil.
- Raw RGBA file → FFmpeg → MP4 H.264: lulus pada tes satu frame kecil; dimensi, codec, dan jumlah frame diperiksa memakai FFprobe.
- `part-02-des.js`: syntax check lulus; struktur 11 scene dan lifecycle diperiksa.
- Benchmark produksi 720p/1080p dan 7.200 frame: belum dijalankan. `npm install` tidak selesai karena network timeout pada container ini; engine runtime memakai `pureimage` dan `esbuild` yang belum tersedia secara lokal.

Tidak ada angka FPS produksi, speedup, CPU render, atau peak RSS render yang direkayasa. Script benchmark mencatat CPU dan peak RSS proses Node, serta peak RSS FFmpeg pada Linux melalui `/proc`; penggunaan CPU FFmpeg belum diukur terpisah. Hasil benchmark yang sebenarnya akan ditulis ke `benchmarks/results/` ketika dijalankan setelah dependensi tersedia.
