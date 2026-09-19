# CMS V6 Prototype

Prototype aplikasi CMS berbasis web dengan integrasi Firebase untuk autentikasi, data organisasi/gereja, sinkronisasi realtime, notifikasi, chat, serta pengelolaan data keuangan.

> **Status:** Eksperimental / pengembangan aktif. Branch ini berisi prototipe fitur dan perbaikan yang belum tentu siap untuk production.

## Branch

Dokumentasi ini dibuat berdasarkan branch `eksperimen-fitur`.

## Fitur yang Terlihat dari Riwayat Pengembangan

- **Autentikasi dan profil pengguna**
  - Pengelolaan profil berbasis Firebase UID.
  - Pengaitan pengguna dengan `churchId` atau organisasi terkait.
  - Penyesuaian alur login untuk menetapkan gereja aktif dari profil pengguna.

- **Manajemen pengguna dan role**
  - Pengembangan pengelolaan pengguna berbasis UID.
  - Perlindungan akses manajemen pengguna berdasarkan role.
  - Eksperimen alur registrasi superadmin.

- **Integrasi Firebase**
  - Sinkronisasi data dengan Firestore.
  - Sinkronisasi riwayat persetujuan.
  - Inisialisasi dan sinkronisasi data realtime.

- **Notifikasi**
  - Perbaikan inisialisasi realtime.
  - Perbaikan aksi pada notifikasi.

- **Chat realtime**
  - Perbaikan fitur chat realtime.
  - Penyempurnaan pengalaman chat pengguna.

- **Keuangan**
  - Pengembangan kategori keuangan.
  - Perbaikan sinkronisasi data terkait modul keuangan.

## Struktur Utama

```text
.
├── index.html
├── app.js
├── firebase.js
├── css/
│   └── style.css
├── js/
│   ├── app.js
│   ├── firebase.js
│   └── realtime-firebase.js
├── package.json
└── README.md
```

Catatan: repositori ini masih memiliki struktur prototipe dan beberapa file implementasi yang berukuran besar. Struktur dapat berubah selama proses refactor.

## Teknologi

- HTML5
- CSS3
- JavaScript
- Firebase
- Firebase Admin SDK untuk backend
- Node.js
- Express
- CORS
- dotenv

Dependensi backend yang tercantum di `package.json`:

- `express`
- `firebase-admin`
- `cors`
- `dotenv`

## Menjalankan Proyek

### 1. Clone repositori

```bash
git clone https://github.com/ysufimanuel/prototypes.git
cd prototypes
git checkout eksperimen-fitur
```

### 2. Install dependensi

```bash
npm install
```

### 3. Konfigurasi environment

Buat file `.env` sesuai kebutuhan backend dan konfigurasi Firebase yang digunakan oleh proyek.

**Jangan commit credential Firebase, service account, token, atau file rahasia ke repositori.**

### 4. Jalankan backend

```bash
npm start
```

Mode pengembangan yang tersedia di `package.json` saat ini menjalankan server yang sama:

```bash
npm run dev
```

## Catatan Keamanan

- Validasi akses harus dilakukan di Firebase Security Rules dan, bila relevan, di backend.
- Jangan mengandalkan pembatasan tombol atau tampilan UI sebagai satu-satunya mekanisme otorisasi.
- Pastikan `churchId`, Firebase UID, dan role pada profil pengguna konsisten.
- Periksa kembali konfigurasi Firebase sebelum melakukan pengujian CRUD.
- Gunakan data uji, bukan data produksi, ketika menguji perubahan permission atau sinkronisasi realtime.

## Riwayat Perubahan Penting

Beberapa perubahan yang tercatat pada riwayat commit branch ini meliputi:

- `fix: realtime data synchronization and finance categories`
- `fix: notification actions and realtime initialization`
- `fix: realtime chat`
- `fix: improve user chat`
- `fix: approval history sync`
- `fix: data sync`
- `fix: invalid churchId validation`
- `fix: protect user management by role`
- `fix: migrate user management to uid-based profile`
- `docs: users menagement optimization`
- `Delete .env`

Riwayat commit tersebut menggambarkan arah pengembangan, bukan jaminan bahwa seluruh fitur telah melalui pengujian menyeluruh.

## Status Pengujian

Belum ada matriks pengujian otomatis yang didokumentasikan di branch ini. Pengujian manual perlu mencakup setidaknya:

- Login dan logout untuk setiap role.
- Pembacaan data lintas `churchId`.
- Create, update, dan delete berdasarkan role.
- Sinkronisasi realtime.
- Chat dan notifikasi.
- Validasi profil pengguna berbasis UID.
- Penanganan pengguna tanpa profil atau dengan `churchId` yang tidak valid.

## Kontribusi

Gunakan branch fitur terpisah untuk perubahan baru. Sertakan ringkasan perubahan, dampak terhadap Firebase Rules, serta langkah pengujian pada setiap pull request atau commit penting.
