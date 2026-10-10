# Firestore Rules Tests

Test ini menjalankan `firestore.rules` melawan Firebase Emulator.

## 1. Install dependency

Dari folder project:

```bash
cd tests
npm install
```

## 2. Jalankan Firestore Emulator

Buka terminal lain dari root project:

```bash
firebase emulators:start --only firestore
```

Biarkan emulator tetap hidup.

## 3. Jalankan test

Di terminal `tests`:

```bash
npm test
```

Semua test harus PASS sebelum rules dianggap aman untuk lanjut ke audit berikutnya.

## Coverage saat ini

- unauthenticated vs private church
- superadmin read/update church sendiri
- admin/user read-only untuk church document
- cross-tenant isolation
- member create/update/delete berdasarkan role
- website draft/page access
- publicSites dan siteSlugs read-only
- protected user profile fields
- superadmin update user dalam tenant yang sama
