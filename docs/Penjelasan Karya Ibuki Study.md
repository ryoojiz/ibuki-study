# Penjelasan Karya Ibuki Study

## Ide Cara Kerja dan Fitur Unik

Ibuki Study adalah ruang belajar berbasis AI yang mengubah catatan mentah menjadi pengetahuan terstruktur, jawaban yang dapat ditelusuri ke sumber, dan latihan aktif. Karya ini dirancang agar pelajar tidak berhenti pada rangkuman otomatis, tetapi dapat memeriksa dasar jawaban, menghubungkan materi, dan menguji pemahaman.

Dokumen ini mencakup seluruh aplikasi web dan Android sebagai acuan bagi juri serta tim demonstrasi.

**Kesimpulan utama:** pembeda Ibuki Study adalah keterhubungan antara sumber, penjelasan AI, organisasi pengetahuan, dan aktivitas belajar. Satu materi dapat ditelusuri ke bukti asalnya, dipakai sebagai konteks percakapan, dihubungkan dengan materi lain, lalu diubah menjadi kuis, flashcard, atau panduan belajar yang dapat dibagikan.

## Ringkasan Karya

Pelajar sering menyimpan foto papan tulis, PDF, dan catatan teks di tempat yang berbeda. Informasi tersebut sulit dicari kembali, hubungan antar topik tidak terlihat, dan chatbot umum dapat menjawab tanpa menunjukkan asal informasi. Ibuki Study menyatukan proses pengumpulan, pemahaman, verifikasi, pengorganisasian, dan latihan dalam satu alur kerja.

| Kebutuhan Pelajar | Respons Ibuki Study | Hasil yang Diharapkan |
| --- | --- | --- |
| Catatan tersebar dalam beberapa format | Unggah gambar, teks, dan PDF ke satu notebook | Materi lebih mudah ditemukan dan dipelajari ulang |
| Rangkuman AI sulit dipercaya | Sitasi per klaim dengan tampilan sumber | Pelajar dapat memeriksa jawaban secara langsung |
| Belajar pasif dari rangkuman | Kuis, flashcard, dan panduan belajar | Pemahaman diuji melalui latihan aktif |
| Hubungan antar topik tidak terlihat | Pohon materi dan graf relasi | Struktur serta keterkaitan pengetahuan lebih jelas |

## Ide Karya

### Masalah yang Diangkat

Banyak alat belajar AI berfokus pada pembuatan teks baru. Masalah pelajar sebenarnya lebih luas: sumber perlu diubah menjadi catatan yang rapi, isi perlu dapat diverifikasi, dan hasilnya harus mendorong latihan. Tanpa keterhubungan ini, AI hanya menjadi mesin jawaban dan tidak membentuk sistem belajar yang berkelanjutan.

### Gagasan Solusi

Kami merancang Ibuki Study sebagai basis pengetahuan pribadi. AI membantu membaca dan menyusun materi, tetapi pengguna tetap mengendalikan sumber yang dipakai, struktur materi, serta keputusan untuk menyimpan hasil. Verifikasi sumber ditempatkan di dalam pengalaman belajar agar pengguna dapat berpindah dari jawaban ke bukti tanpa keluar dari aplikasi.

### Sasaran Pengguna

Sasaran utama adalah pelajar yang belajar dari campuran foto catatan, papan tulis, berkas teks, dan dokumen. Aplikasi juga relevan bagi kelompok belajar yang ingin menata materi per mata pelajaran dan memakai AI dengan konteks yang dapat dipilih secara eksplisit.

## Cara Kerja

Alur utama bergerak dari sumber mentah menuju aktivitas belajar. Hasil setiap tahap dapat dipakai kembali oleh tahap berikutnya.

1. **Masuk dan memuat profil**  
   Pengguna masuk dengan email dan kata sandi atau Google. Supabase mengelola sesi, profil, dan pemulihan kata sandi untuk web maupun Android.

2. **Mengumpulkan sumber**  
   Pengguna memasukkan gambar, berkas teks, atau PDF. Gambar diperkecil sebelum dikirim, teks dibaca langsung, dan PDF diekstrak per halaman menggunakan PDF.js.

3. **Menganalisis dan menyusun notebook**  
   Model visi atau model percakapan menghasilkan judul, transkripsi, rangkuman Markdown, mata pelajaran, serta jalur materi. Instruksi model meminta sitasi granular untuk klaim yang berasal dari sumber.

4. **Meninjau sebelum menyimpan**  
   Judul, mata pelajaran, topik, rangkuman, dan transkripsi dapat diperiksa serta diubah. Berkas asli diunggah ke penyimpanan dan metadata notebook disimpan ke basis data.

5. **Mengatur basis pengetahuan**  
   Notebook ditempatkan pada pohon materi dengan kedalaman fleksibel. Pengguna dapat menambah, mengganti nama, memindahkan, mengelompokkan, atau meminta usulan pengelompokan AI.

6. **Bertanya dengan konteks terpilih**  
   Chat tersedia pada tingkat notebook, mata pelajaran, dan seluruh koleksi. Panel sumber memungkinkan pengguna memilih cabang atau notebook yang masuk ke konteks. Jawaban diberikan secara streaming dan riwayat disimpan per cakupan.

7. **Memeriksa sitasi**  
   Penanda sitasi pada rangkuman dan chat membuka sumber terkait. Teks dicari dan disorot secara toleran terhadap variasi spasi, PDF menampilkan penanda halaman, dan gambar dapat menyorot kotak koordinat yang dirujuk.

8. **Berlatih dan menjaga progres**  
   Konteks notebook atau mata pelajaran dapat diubah menjadi kuis pilihan ganda dan flashcard. Kuis menyimpan jawaban, status, nilai terbaik, serta hari belajar. Data streak disinkronkan ke widget Android.

9. **Membuat keluaran baru**  
   Dari percakapan, pengguna dapat menghasilkan panduan belajar untuk diekspor sebagai PDF atau materi baru yang ditinjau sebelum menjadi notebook.

### Aliran Data Utama

| Tahap | Masukan | Proses | Keluaran |
| --- | --- | --- | --- |
| Akuisisi | Gambar, TXT, PDF | Kompresi atau ekstraksi | Daftar sumber |
| Pemahaman | Isi sumber | OCR, sintesis, klasifikasi | Notebook terstruktur |
| Konteks | Notebook pilihan | Perakitan konteks dan registri sumber | Prompt berbasis materi |
| Interaksi | Pertanyaan atau gambar | Respons streaming dan tool action | Jawaban, kuis, flashcard, panduan |
| Penyimpanan | Notebook dan progres | Supabase Database dan Storage | Riwayat lintas sesi |

## Fitur Unik

### Sitasi yang Dapat Dibuka Kembali

Setiap sumber diberi nomor konsisten yang dipakai oleh prompt AI dan renderer antarmuka. Sitasi tidak berhenti sebagai catatan kaki. Pengguna dapat membuka kutipan yang dirujuk, menuju bagian teks yang disorot, halaman PDF, atau area spesifik pada foto catatan. Mekanisme ini membuat pemeriksaan sumber menjadi bagian dari pengalaman utama.

### Konteks Chat yang Dikendalikan Pengguna

Pengguna memilih sendiri notebook yang boleh menjadi konteks. Pilihan dapat dilakukan pada satu dokumen, satu cabang materi, satu mata pelajaran, atau seluruh koleksi. Aplikasi menyimpan snapshot registri sumber pada setiap jawaban AI sehingga nomor sitasi lama tetap mengarah ke sumber yang benar walaupun pilihan konteks berubah.

### Dua Cara Melihat Pengetahuan

Pohon materi menunjukkan hierarki dari mata pelajaran menuju submateri, sedangkan graf menunjukkan hubungan semantik antar notebook. Relasi yang didukung adalah prasyarat, pengembangan dari materi sebelumnya, keterkaitan, perbandingan, dan contoh. Hubungan dapat dibuat manual atau disarankan AI. Penyegaran AI tidak menimpa hubungan manual.

### Siklus Belajar Aktif

Kuis dapat diatur berdasarkan tingkat kesulitan, jumlah soal, dan fokus topik. Percobaan yang belum selesai dapat dilanjutkan, nilai terbaik disimpan, dan setiap jawaban mencatat hari belajar. Flashcard menyediakan mode balik pertanyaan dan jawaban, sedangkan widget Android mengingatkan status belajar harian.

### Percakapan Menjadi Artefak Belajar

Pesan atau gambar dalam chat dapat diubah menjadi panduan belajar yang diekspor sebagai PDF atau menjadi notebook baru. Untuk notebook baru, pengguna melihat pratinjau judul, mata pelajaran, topik, rangkuman, dan transkripsi sebelum menyimpan. Alur ini menjaga keputusan akhir pada pengguna.

### Dukungan Multiplatform dan Personalisasi

- Aplikasi web dibangun dengan Vue 3 dan Vite.
- Aplikasi Android dibungkus menggunakan Capacitor.
- Login mendukung email, Google OAuth, dan pemulihan kata sandi.
- Antarmuka dan keluaran AI mendukung bahasa Inggris, Spanyol, Prancis, Jerman, Mandarin, dan Indonesia.
- Pengguna dapat mengatur mode gelap, warna utama, profil, mata pelajaran, dan preferensi perilaku.
- Widget Android menyediakan akses cepat ke belajar, global chat, dan notebook baru.

## Arsitektur dan Teknologi

Aplikasi memakai arsitektur klien modern dengan layanan cloud untuk autentikasi, data, dan berkas. Pemrosesan AI mengikuti antarmuka chat completions yang kompatibel dengan OpenAI, sedangkan Capacitor membungkus pengalaman web menjadi aplikasi Android.

| Lapisan | Teknologi | Peran |
| --- | --- | --- |
| Antarmuka | Vue 3, Vite, CSS | Dashboard, notebook, chat, kuis, graf, dan pengaturan |
| AI | API chat completions kompatibel OpenAI | Analisis sumber, chat streaming, kuis, flashcard, pengelompokan, dan relasi |
| Dokumen | PDF.js, KaTeX, html2pdf.js | Ekstraksi PDF, rumus matematika, dan ekspor panduan |
| Visualisasi | D3 Force | Tata letak graf hubungan materi yang interaktif |
| Backend | Supabase Auth, Database, Storage | Akun, data pribadi pengguna, sumber, riwayat, dan progres |
| Mobile | Capacitor Android dan plugin widget | Aplikasi Android, deep link, berbagi PDF, dan widget belajar |
| Lokalisasi | Layanan i18n internal | Antarmuka dan keluaran AI dalam enam bahasa |

### Model Data Utama

| Entitas | Isi | Perlindungan atau Relasi |
| --- | --- | --- |
| Notebook | Judul, ringkasan, transkripsi, sumber, flashcard | Milik pengguna dan dapat ditempatkan pada material |
| Material | Nama, induk, urutan | Self reference untuk hierarki; penghapusan tidak menghapus notebook |
| Material Relationship | Sumber, target, tipe, origin, confidence | Relasi unik per pengguna dan tipe |
| Quiz | Soal JSON, kesulitan, fokus, progres | Cakupan notebook atau mata pelajaran |
| Chat | Peran, isi, metadata sumber | Riwayat per notebook, mata pelajaran, atau global |
| Study Day | Tanggal lokal pengguna | Satu catatan per pengguna per hari |

Kebijakan Row Level Security pada tabel migrasi membatasi kuis, material, relasi, percakapan, dan hari belajar berdasarkan identitas pengguna. Operasi layanan juga menambahkan filter `user_id` pada pembacaan dan perubahan data.

## Skenario Demonstrasi untuk Juri

Skenario berikut menunjukkan alur paling representatif dalam sekitar lima menit. Gunakan satu foto catatan dan satu berkas teks agar proses analisis stabil selama demonstrasi.

| Waktu | Tindakan Demonstrasi | Hal yang Perlu Diamati |
| --- | --- | --- |
| 0.00-0.40 | Masuk dan buka dashboard | Statistik notebook, mata pelajaran, interaksi, dan streak |
| 0.40-1.30 | Unggah foto serta TXT lalu proses | OCR, judul, klasifikasi, rangkuman, dan tahap review |
| 1.30-2.05 | Buka notebook dan klik sitasi | Kutipan sumber atau area gambar dapat diperiksa |
| 2.05-2.55 | Buka chat dan ubah pilihan konteks | Jawaban memakai notebook yang dipilih dan sitasi tetap konsisten |
| 2.55-3.45 | Buat kuis atau flashcard | Kesulitan, fokus, progres, penilaian, dan penjelasan jawaban |
| 3.45-4.30 | Buka graf materi dan relasi | Hubungan manual serta saran AI antar notebook |
| 4.30-5.00 | Ekspor panduan atau tunjukkan widget | Hasil belajar dapat dibagikan dan kebiasaan harian dipantau |

### Poin Penilaian yang Dapat Diverifikasi

- Relevansi masalah terlihat dari dukungan terhadap catatan sehari-hari dan kebutuhan verifikasi jawaban AI.
- Kedalaman teknis terlihat pada alur multimodal, sitasi terstruktur, penyimpanan cloud, graf, dan integrasi Android.
- Kontrol pengguna terlihat pada tahap review, pemilihan konteks, pengelolaan hierarki, dan relasi manual.
- Dampak pembelajaran terlihat pada perpindahan dari rangkuman menuju kuis, flashcard, progres, dan streak.
- Skalabilitas konsep terlihat pada cakupan notebook, mata pelajaran, dan seluruh basis pengetahuan pengguna.

## Status Kesiapan dan Batas Implementasi

Bagian ini menjelaskan kondisi repository saat dokumen disusun. Informasi ini membantu tim memilih jalur demo yang stabil dan menghindari klaim yang belum sepenuhnya terhubung pada runtime.

| Temuan | Dampak | Tindakan Sebelum Penjurian |
| --- | --- | --- |
| PDF telah diekstrak per halaman, tetapi cabang analisis AI saat ini hanya meneruskan tipe `text` dan `image` | Isi PDF berpotensi tidak masuk ke analisis notebook | Normalisasi sumber PDF menjadi `text` atau tambahkan cabang `pdf` pada payload AI |
| Pengaturan provider dan model tersimpan di profil, tetapi `saveLLM` belum menyinkronkan nilai tersebut ke `aiService` | Perubahan pada tab LLM belum tentu memengaruhi runtime | Hubungkan base URL, API key, dan model ke konfigurasi layanan saat penyimpanan |
| Tab History pada panel konteks masih berupa placeholder | Riwayat pesan tersimpan, tetapi belum ada daftar percakapan terpisah | Demonstrasikan riwayat per cakupan dan jangan mengklaim pengelolaan multi-percakapan |
| Berkas sumber memakai public URL dari Supabase Storage | Materi sensitif memerlukan perlindungan tambahan | Gunakan bucket privat dan signed URL untuk penggunaan produksi |
| Belum terlihat rangkaian pengujian aplikasi otomatis pada repository | Risiko regresi perlu ditangani melalui uji manual | Jalankan build dan checklist demo pada web serta Android sebelum presentasi |

## Naskah Video Penjelasan Karya

Durasi sasaran adalah 2 menit 30 detik. Narasi dibuat untuk video rekaman layar dengan potongan singkat pada setiap fitur utama.

### 0.00-0.15 Pembuka

**Visual:** logo dan dashboard.

**Narasi:**

> Ini adalah Ibuki Study, ruang belajar berbasis AI yang mengubah catatan menjadi pengetahuan terstruktur, dapat diperiksa, dan siap dipakai untuk latihan.

### 0.15-0.40 Sumber Menjadi Notebook

**Visual:** unggah foto dan berkas TXT, lalu tampilkan hasil analisis.

**Narasi:**

> Pelajar biasanya memiliki foto papan tulis, dokumen, dan catatan teks yang tersebar. Di Ibuki Study, sumber tersebut dikumpulkan dalam satu notebook dan diproses menjadi judul, transkripsi, rangkuman, serta jalur materi.

### 0.40-1.05 Verifikasi Sumber

**Visual:** klik sitasi dan buka sumber.

**Narasi:**

> Setiap fakta yang berasal dari materi membawa sitasi. Pengguna dapat membuka kutipan, halaman PDF, atau area tertentu pada gambar. Dengan demikian, jawaban AI dapat diperiksa tanpa meninggalkan aplikasi.

### 1.05-1.30 Chat dengan Konteks Terpilih

**Visual:** buka panel konteks dan pilih beberapa notebook.

**Narasi:**

> Chat tersedia untuk satu notebook, satu mata pelajaran, atau seluruh koleksi. Pengguna memilih sendiri sumber yang dipakai, dan aplikasi menyimpan konteks sitasi setiap jawaban agar referensi lama tetap benar.

### 1.30-1.55 Struktur Pengetahuan

**Visual:** tampilkan pohon materi lalu graf hubungan.

**Narasi:**

> Materi diatur melalui hierarki yang fleksibel dan graf hubungan. AI dapat menyarankan keterkaitan, sementara pengguna tetap dapat membuat atau memperbaiki relasi secara manual.

### 1.55-2.15 Latihan Aktif

**Visual:** buat kuis, jawab satu soal, tampilkan hasil, lalu buka flashcard.

**Narasi:**

> Rangkuman kemudian menjadi aktivitas belajar. Ibuki Study membuat kuis sesuai tingkat kesulitan dan fokus, menyimpan progres serta nilai terbaik, dan menyediakan flashcard untuk pengulangan.

### 2.15-2.30 Penutup

**Visual:** ekspor panduan PDF dan widget Android.

**Narasi:**

> Hasil percakapan dapat disimpan sebagai materi atau dibagikan sebagai PDF. Pada Android, widget menampilkan streak dan akses cepat untuk belajar. Ibuki Study menyatukan sumber, penjelasan, verifikasi, dan latihan dalam satu alur.

### Daftar Pengambilan Gambar

- Rekam layar dengan data contoh yang singkat dan mudah dibaca.
- Perbesar kursor saat membuka sitasi agar mekanisme verifikasi terlihat jelas.
- Gunakan satu transisi sederhana antar layar.
- Jangan menampilkan API key atau data akun.
- Tampilkan hasil kuis dan graf cukup lama agar juri dapat membaca status serta tipe relasinya.

## Jejak Implementasi

Komponen berikut menjadi rujukan teknis utama untuk memeriksa kesesuaian penjelasan dengan repository.

| Area | Berkas Utama |
| --- | --- |
| Navigasi dan cakupan aplikasi | `src/App.vue` |
| Pembuatan notebook | `src/components/CreateNotebookView.vue` dan `src/services/ai.js` |
| Sitasi dan penampil sumber | `src/services/citations.js` dan `src/components/SourceViewerModal.vue` |
| Chat dan pemilih konteks | `src/components/ChatView.vue` dan `src/components/ChatContextSidebar.vue` |
| Kuis, flashcard, dan streak | `src/components/QuizPanel.vue`, `src/components/FlashcardView.vue`, `src/services/db.js`, dan `src/services/widget.js` |
| Pohon dan graf pengetahuan | `src/components/MaterialManager.vue`, `src/services/materials.js`, dan `src/components/MaterialGraphView.vue` |
| Data dan keamanan | `src/services/db.js` serta folder `migrations` |
| Android | `capacitor.config.json` dan `android/app/src/main` |
