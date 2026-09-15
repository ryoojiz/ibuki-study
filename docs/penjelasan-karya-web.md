# Penjelasan Karya Ibuki Study
Ibuki Study adalah aplikasi web berbasis AI yang mengubah catatan menjadi materi belajar terstruktur. Pengguna dapat mengunggah foto catatan, berkas teks, atau PDF, lalu memperoleh transkripsi, rangkuman, klasifikasi materi, dan sitasi sumber.

Materi tersebut dapat digunakan untuk chat berbasis konteks, kuis, flashcard, graf pengetahuan, dan panduan belajar dalam bentuk PDF.

## Ide Karya

Pelajar biasanya menyimpan bahan belajar dalam berbagai bentuk dan lokasi. Jawaban dari chatbot umum juga sering sulit diperiksa karena tidak menunjukkan bagian sumber yang digunakan.

Ibuki Study menyatukan tiga kegiatan:

1. Mengubah sumber mentah menjadi materi yang rapi.
2. Menjawab pertanyaan berdasarkan sumber yang dipilih pengguna.
3. Mengubah materi menjadi latihan aktif.

Pengguna tetap memegang kendali melalui tahap peninjauan, pemilihan konteks chat, pengaturan materi, dan pemeriksaan sitasi.

## Cara Kerja

1. Pengguna mengunggah gambar, TXT, atau PDF.
2. Sistem membaca sumber dan meminta AI membuat judul, transkripsi, rangkuman, mata pelajaran, serta topik.
3. Pengguna meninjau hasil sebelum menyimpannya sebagai notebook.
4. Notebook ditempatkan dalam struktur mata pelajaran dan materi.
5. Notebook yang dipilih menjadi konteks percakapan dengan AI.
6. Jawaban menampilkan sitasi yang dapat dibuka kembali ke sumber.
7. Materi dapat diubah menjadi kuis, flashcard, atau panduan belajar.
8. Hubungan antar notebook dapat dilihat melalui graf pengetahuan.

## Cara Menggunakan

### 1 Masuk ke Aplikasi

1. Buka aplikasi web Ibuki Study.
2. Masuk menggunakan email dan kata sandi atau akun Google.
3. Dashboard menampilkan jumlah notebook, mata pelajaran, interaksi AI, dan aktivitas belajar.

### 2 Membuat Notebook

1. Klik **New Notebook**.
2. Unggah satu atau lebih berkas foto atau TXT.
3. Klik **Process Sources**.
4. Tunggu AI menghasilkan judul, mata pelajaran, topik, rangkuman, dan transkripsi.
5. Periksa atau ubah hasilnya.
6. Klik **Save Notebook**.

### 3 Memeriksa Sitasi

1. Buka notebook yang baru dibuat.
2. Pilih tab **Summary** atau **Transcription**.
3. Klik salah satu nomor sitasi.
4. Perlihatkan kutipan atau area sumber yang disorot.

### 4 Menggunakan Chat Berbasis Materi

1. Klik **Discuss this Material**.
2. Buka panel **Sources** di sisi kanan.
3. Pilih notebook atau cabang materi yang akan digunakan sebagai konteks.
4. Ajukan pertanyaan tentang materi.
5. Klik sitasi pada jawaban untuk memeriksa sumber.

Chat juga dapat dibuka dari halaman mata pelajaran atau menu **Global Chat** untuk memakai cakupan materi yang lebih luas.

### 5 Membuat Kuis

1. Buka tab **Quiz** pada notebook.
2. Pilih tingkat kesulitan.
3. Tentukan jumlah soal dan fokus topik.
4. Klik **Generate Quiz**.
5. Jawab beberapa pertanyaan lalu tampilkan hasil dan penjelasannya.
6. Kembali ke daftar kuis untuk menunjukkan progres dan nilai terbaik.

### 6 Menggunakan Flashcard

1. Dari chat notebook, minta AI membuat flashcard.
2. Konfirmasikan jumlah dan fokus materi.
3. Buka **Study Flashcards**.
4. Klik kartu untuk melihat pertanyaan dan jawaban secara bergantian.

### 7 Melihat Hubungan Materi

1. Buka menu **Material Graph**.
2. Klik node untuk melihat ringkasan dan hubungannya.
3. Filter graf berdasarkan mata pelajaran atau tipe hubungan.
4. Tambahkan hubungan manual atau klik **Refresh Relationships** untuk memperoleh saran AI.

### 8 Membuat Panduan Belajar

1. Buka chat dan kirim instruksi atau gambar.
2. Pilih pembuatan **Study Guide**.
3. Sistem menyusun panduan berdasarkan pesan dan konteks yang dipilih.
4. Ekspor hasil sebagai PDF.

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

## Teknologi Web

- **Vue 3 dan Vite** untuk antarmuka.
- **Supabase Auth, Database, dan Storage** untuk akun, notebook, sumber, chat, dan progres.
- **API AI kompatibel OpenAI** untuk analisis, chat streaming, kuis, flashcard, pengelompokan, dan hubungan materi.
- **PDF.js** untuk membaca PDF.
- **KaTeX** untuk menampilkan rumus matematika.
- **D3 Force** untuk graf pengetahuan.
- **html2pdf.js** untuk mengekspor panduan belajar.
