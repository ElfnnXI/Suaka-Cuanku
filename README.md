# Suaka Cuanku

Suaka Cuanku adalah web app manajemen pinjaman berbasis Next.js App Router dengan tiga role utama:

- `USER` untuk registrasi, login, pengajuan pinjaman, pembayaran, dan melihat riwayat.
- `ADMIN` untuk memverifikasi pinjaman, memproses pembayaran, mengelola akun, dan memantau statistik operasional.
- `AUDITOR` untuk akses baca, meninjau log audit, dan menghasilkan laporan audit ringkas.

Dokumentasi proyek sekarang dipusatkan hanya di file ini. Konten lama dari `ERD.md` dan `kemanan.txt` sudah digabung ke bagian database dan keamanan di bawah.

## Ringkasan Analisis Kode

Analisis ini mengacu pada implementasi aktual di repository, bukan asumsi desain:

- Frontend dan backend berada dalam satu proyek Next.js 16.2.2 dengan `app/` dan route handler di `app/api/`.
- Database memakai Prisma + PostgreSQL dengan 5 model inti: `User`, `Loan`, `Payment`, `Comment`, dan `AuditLog`.
- Mekanisme auth memakai JWT di cookie `HttpOnly`, bukan `localStorage`.
- Aplikasi memiliki 28 file route API dan dashboard terpisah untuk `USER`, `ADMIN`, dan `AUDITOR`.
- Proteksi keamanan utama sudah ada: RBAC, validasi origin, CSRF, rate limiting in-memory, security headers, cache control, dan audit trail.
- Tidak ada suite test otomatis di `package.json`, jadi kualitas saat ini bertumpu pada validasi runtime, Prisma, Zod, dan pengujian manual.

## Stack Aktual

- Framework: Next.js `16.2.2`
- UI: React `19.2.4`
- Bahasa: TypeScript
- Styling: Tailwind CSS `4`
- ORM: Prisma `6.19.3`
- Database: PostgreSQL
- Validasi: Zod `4`
- Password hashing: `bcryptjs`
- Token: `jsonwebtoken`
- Icon set: `lucide-react`

## Struktur Proyek

```text
app/
  api/
    admin/                 API admin
    auditor/               API auditor read-only dan report
    auth/                  login, register, logout, profile, password
    loan/                  pengajuan dan daftar pinjaman user
    payment/               pengajuan pembayaran user
    comment/               komentar publik
    auditor-accounts/      CRUD akun auditor oleh admin
  admin/                   halaman dashboard admin
  auditor/                 halaman dashboard auditor
  dashboard/               halaman dashboard user
  login/ register/         halaman auth publik
  settings/account/        pengaturan profil dan password
components/
  dashboard/               layout dashboard lintas role
  landing/                 section landing page
  ui/                      button dan input dasar
lib/
  auth.ts                  JWT, auth guard, audit/security logging helper
  client-api.ts            fetch helper browser + CSRF header
  prisma.ts                singleton Prisma client
  risk-analysis.ts         analisis risiko user
  security.ts              cookie, CSRF, origin, rate limit, cache control
prisma/
  schema.prisma            schema database utama
  seed.ts                  seed admin default
  clear.ts                 hapus data operasional
proxy.ts                   proteksi route awal untuk halaman privat dan API
next.config.ts             security headers global
```

## Arsitektur Singkat

Alur utama aplikasi:

1. Pengguna mengakses halaman publik `/`, `/login`, atau `/register`.
2. Setelah login/register, server membuat JWT dan menyimpannya ke cookie `token`.
3. Browser mengambil data sesi dari `/api/auth/me`; endpoint ini juga memastikan cookie CSRF tersedia.
4. Semua request client yang sensitif melewati `apiFetch()` di `lib/client-api.ts` dengan `credentials: 'include'` dan header `x-csrf-token`.
5. `proxy.ts` melakukan gate awal untuk dashboard dan API privat.
6. Route handler tetap melakukan validasi lanjutan melalui `requireAuth`, `requireAdmin`, atau `requireAuditor`.

## Fitur Berdasarkan Role

### Publik

- Landing page di `/`
- Registrasi di `/register`
- Login di `/login`
- Pengiriman komentar publik melalui `POST /api/comment`

### User

- Overview dashboard di `/dashboard/overview`
- Ajukan pinjaman di `/dashboard/apply-loan`
- Ajukan pembayaran di `/dashboard/payment`
- Lihat riwayat pinjaman dan pembayaran di `/dashboard/history`
- Ubah profil dan password di `/settings/account`

Perilaku bisnis penting:

- Limit dasar pinjaman adalah `Rp 30.000.000`.
- Limit bisa naik bertahap sampai `Rp 45.000.000` berdasarkan riwayat pembayaran.
- User dengan pinjaman aktif harus sudah membayar minimal 50% sebelum mengajukan pinjaman baru.
- Pembayaran user tidak langsung melunasi pinjaman; status awal pembayaran adalah `PENDING` dan harus dikonfirmasi admin.

### Admin

- Overview statistik operasional di `/admin/overview`
- Kelola status pinjaman di `/admin/loans`
- Konfirmasi atau tolak pembayaran di `/admin/payments`
- Kelola user di `/admin/users`
- Kelola akun admin di `/admin/admins`
- Kelola akun auditor di `/admin/auditors`
- Lihat komentar publik di `/admin/comments`
- Reset password akun lain melalui endpoint admin

Perilaku bisnis penting:

- Admin dapat mengubah status user, risk level, dan risk reason.
- Admin tidak dapat menghapus akun sendiri.
- Admin tidak dapat mereset password dirinya sendiri lewat endpoint reset admin.
- Konfirmasi pembayaran akan memeriksa apakah total pembayaran sudah melunasi total utang; jika ya, status `Loan` berubah menjadi `PAID`.

### Auditor

- Overview di `/auditor/overview`
- Akses data user di `/auditor/users`
- Akses data pinjaman di `/auditor/loans`
- Akses data pembayaran di `/auditor/payments`
- Akses log audit di `/auditor/audit-logs`
- Generate laporan audit di `/auditor/reports`

Perilaku bisnis penting:

- Endpoint auditor bersifat read-only.
- Aktivitas auditor seperti melihat data dan generate report dicatat ke `AuditLog`.

## Inventaris API

Berikut kelompok endpoint yang terlihat dari kode:

### Auth

- `POST /api/auth/register`
- `POST /api/auth/login`
- `POST /api/auth/logout`
- `GET /api/auth/me`
- `PATCH /api/auth/update-profile`
- `POST /api/auth/change-password`

### User Domain

- `POST /api/comment`
- `GET|POST /api/loan/apply`
- `GET /api/loan/user`
- `GET|POST /api/payment`

### Admin Domain

- `GET /api/admin/users`
- `PATCH|DELETE /api/admin/users/[id]`
- `GET /api/admin/loans`
- `PATCH /api/admin/loans/[id]`
- `GET /api/admin/payments`
- `PATCH /api/admin/payments/[id]`
- `GET /api/admin/comments`
- `GET /api/admin/financial-stats`
- `POST /api/admin/reset-password`
- `GET|POST|PATCH|DELETE /api/admin/admin-users`
- `GET|POST|PATCH|DELETE /api/auditor-accounts`

### Auditor Domain

- `GET /api/auditor/users`
- `GET /api/auditor/loans`
- `GET /api/auditor/payments`
- `GET /api/auditor/comments`
- `GET /api/auditor/financial-stats`
- `GET /api/auditor/audit-logs`
- `GET /api/auditor/audit-report`

## Database dan ERD

Sumber kebenaran database ada di `prisma/schema.prisma`.

### Entitas Utama

#### `User`

- Menyimpan identitas akun, email login, password hash, role, status, risk level, risk reason, dan loan limit.
- Relasi:
  - satu `User` memiliki banyak `Loan`
  - satu `User` memiliki banyak `AuditLog`

#### `Loan`

- Menyimpan nominal pinjaman, bunga, durasi, status, dan pemilik pinjaman.
- Relasi:
  - banyak `Loan` milik satu `User`
  - satu `Loan` memiliki banyak `Payment`

#### `Payment`

- Menyimpan pengajuan pembayaran terhadap suatu pinjaman.
- Status pembayaran diproses admin: `PENDING`, `PAID`, atau `REJECTED`.

#### `Comment`

- Menyimpan komentar publik dari landing page.
- Tidak memiliki relasi ke tabel lain.

#### `AuditLog`

- Menyimpan jejak aktivitas admin atau auditor untuk event sensitif dan aktivitas audit.

### Diagram ERD Mermaid

```mermaid
erDiagram
    User {
        string id PK
        string name
        string email UK
        string password
        string role
        string status
        string riskLevel
        string riskReason
        int loanLimit
        datetime updatedAt
        datetime createdAt
    }

    Loan {
        string id PK
        string userId FK
        float amount
        float interest
        int duration
        string status
        datetime createdAt
    }

    Payment {
        string id PK
        string loanId FK
        float amount
        datetime paidAt
        string status
    }

    Comment {
        string id PK
        string name
        string email
        string message
        datetime createdAt
    }

    AuditLog {
        string id PK
        string auditorId FK
        string action
        string description
        string details
        datetime createdAt
    }

    User ||--o{ Loan : has
    Loan ||--o{ Payment : has
    User ||--o{ AuditLog : logs
```

### Relasi

- `User` 1..n `Loan`
- `Loan` 1..n `Payment`
- `User` 1..n `AuditLog`
- `Comment` berdiri sendiri

Semua foreign key utama memakai `onDelete: Cascade`.

### Enum

#### `Role`

- `USER`
- `ADMIN`
- `AUDITOR`

#### `UserStatus`

- `ACTIVE`
- `SUSPENDED`
- `BLOCKED`

#### `RiskLevel`

- `LOW`
- `MEDIUM`
- `HIGH`

#### `LoanStatus`

- `PENDING`
- `APPROVED`
- `REJECTED`
- `PAID`

#### `PaymentStatus`

- `PENDING`
- `PAID`
- `REJECTED`

### Aturan Risiko User

Analisis risiko dihitung di `lib/risk-analysis.ts` berdasarkan riwayat pinjaman:

- `LOW` untuk user baru atau user dengan riwayat pembayaran baik
- `MEDIUM` untuk banyak pinjaman tertunda atau rejection rate menengah
- `HIGH` jika lebih dari 50% pinjaman ditolak

Endpoint admin `GET /api/admin/users` akan menghitung ulang risk level dan memperbarui data user bila hasil analisis berubah.

### Catatan Seed

`prisma/seed.ts` sekarang tidak lagi memakai kredensial bootstrap hardcoded.

Untuk membuat admin awal, proses seed membutuhkan:

- `SEED_ADMIN_EMAIL`
- `SEED_ADMIN_PASSWORD`

Dengan pendekatan ini, password bootstrap tidak tersimpan langsung di source code.

## Keamanan Aplikasi

Bagian ini menggabungkan dan memperbarui isi dokumen keamanan lama berdasarkan kode saat ini.

### 1. Autentikasi dan Session

- JWT dibuat di `lib/auth.ts`.
- Cookie sesi utama bernama `token`.
- Cookie sesi memakai `HttpOnly`, `sameSite: 'lax'`, dan `secure` aktif di production jika `SESSION_COOKIE_SECURE !== 'false'`.
- Login dan register memakai alur sederhana: password diverifikasi, lalu sesi langsung dibuat.

### 2. Otorisasi dan Role Guard

- `proxy.ts` membatasi akses awal ke area `/dashboard`, `/admin`, `/auditor`, dan API sensitif.
- `requireAuth`, `requireAdmin`, dan `requireAuditor` melakukan validasi lanjutan di route handler.
- Role dipisahkan di server, bukan hanya di UI.

### 3. Pemeriksaan Status Akun

- User dengan status `SUSPENDED` atau `BLOCKED` ditolak pada endpoint yang memakai `requireAuth`.
- Ini mencegah akun bermasalah tetap mengakses endpoint sensitif walau token masih valid.

### 4. Origin Validation dan CSRF

- `lib/security.ts` memvalidasi header `Origin`.
- Request mutasi penting memakai `enforceMutationSecurity(..., { requireCsrf: true })`.
- `GET /api/auth/me` memastikan cookie CSRF ada.
- `lib/client-api.ts` otomatis mengirim header `x-csrf-token` pada request mutasi.

### 5. Rate Limiting

- Rate limit disimpan terpusat di tabel database `rate_limit_entries`.
- Sudah diterapkan pada login, register, comment, loan apply, dan payment.
- Khusus login, respons gagal sekarang juga mengembalikan metadata percobaan:
  - berapa kali password sudah dicoba pada window aktif
  - berapa sisa kesempatan sebelum harus menunggu
  - berapa menit waktu tunggu sampai window berikutnya terbuka
- Backoff login sekarang bertingkat:
  - percobaan berlebih awal mengunci maksimal `10 menit`
  - bila key login yang sama terus dipaksa sampai lebih dari `10x`, waktu tunggu naik maksimal `30 menit`
- Saat limit login terlampaui, API mengembalikan `Retry-After` dan pesan yang menjelaskan jumlah percobaan yang sudah habis.

### 6. Validasi Input Server-side

- Route mutasi utama memakai Zod.
- Validasi mencakup email, UUID, nominal, password policy, role, dan status.

### 7. Password Security

- Password di-hash menggunakan `bcryptjs`.
- Password policy minimal 10 karakter dengan huruf, angka, dan simbol diterapkan di register, change password, create admin/auditor, dan reset password.
- Password baru juga diperiksa terhadap denylist password umum/bocor dan verifikasi breach berbasis hash-range sebelum boleh dipakai.
- Form register dan pembuatan akun baru menahan submit sampai password lolos pemeriksaan keamanan.
- Reset password hanya dapat dilakukan oleh admin melalui panel admin.

### 8. Pembatasan Akses Data

- User hanya dapat membayar pinjaman miliknya sendiri.
- Query pinjaman user dibatasi berdasarkan `user.id` dari sesi.
- Admin dan auditor memiliki endpoint terpisah sehingga tidak bercampur dengan endpoint user.

### 9. Audit Trail

- Aktivitas penting dicatat ke tabel `AuditLog`.
- Event yang dicatat mencakup login, registrasi, update profil, ganti password, reset password, perubahan status pinjaman, perubahan status pembayaran, CRUD admin/auditor, dan generate audit report.

### 10. Security Headers dan Cache Control

- `next.config.ts` menambahkan:
  - `Content-Security-Policy`
  - `Referrer-Policy`
  - `X-Content-Type-Options`
  - `X-Frame-Options`
  - `Permissions-Policy`
- Respons sensitif diberi `Cache-Control: no-store, max-age=0`.

### 11. Identitas dan Integritas Data

- Semua model utama memakai UUID.
- Email user bersifat unik.
- Relasi antar tabel didefinisikan jelas di Prisma dengan foreign key dan cascade delete.

## Status Hardening Terbaru

Setelah fase perbaikan awal, status mitigasi untuk temuan utama adalah:

- `SC-SEC-001` fixed:
  - seed admin tidak lagi memakai email dan password hardcoded
  - proses seed sekarang mewajibkan `SEED_ADMIN_EMAIL` dan `SEED_ADMIN_PASSWORD`
- `SC-SEC-002` fixed:
  - redirect login sekarang hanya menerima path internal yang aman
  - pola `//domain-asing` dan path dengan backslash ditolak
- `SC-SEC-003` partially fixed:
  - akun `BLOCKED` dan `SUSPENDED` sekarang ditolak saat login
  - `/api/auth/me` dan update profile sekarang memakai `requireAuth()`
  - token sekarang membawa `sessionVersion`
  - reset password, change password, dan perubahan status akun sekarang meng-increment `sessionVersion` untuk memutus token lama pada jalur validasi server
- `SC-SEC-004` fixed:
  - aplikasi tidak lagi percaya header proxy seperti `x-forwarded-for` secara default
  - trust header proxy sekarang harus diaktifkan eksplisit lewat `TRUST_PROXY_HEADERS=true`
  - rate limiter sekarang memakai tabel database terpusat `rate_limit_entries`
  - flow login sekarang memberi umpan balik jumlah percobaan password, sisa kesempatan, dan waktu tunggu dalam menit untuk membantu mitigasi brute-force dan otomasi login agresif
- `SC-SEC-005` fixed:
  - `unsafe-inline` sudah dihapus dari `script-src` production
- `SC-SEC-006` fixed:
  - throttle tambahan sudah ditambahkan ke reset password admin, manajemen admin, manajemen auditor, dan generate audit report
  - gap utama yang terdokumentasi untuk endpoint sensitif sudah ditutup
- `SC-SEC-007` fixed:
  - `/settings/:path*` sekarang ikut dilindungi `proxy.ts`

## Residual Risk dan Temuan Lanjutan

Beberapa risiko masih tersisa dan penting dicatat secara jujur:

### RR-001 - Session revocation belum penuh di layer `proxy.ts`

- Severity: `Medium`
- Status: `Sebagian besar tertutup, tetapi belum absolut`
- Ringkasan:
  - Session versioning sudah diterapkan pada token dan divalidasi di jalur auth server.
  - Namun `proxy.ts` masih melakukan optimistic check berbasis JWT signature dan role tanpa lookup database.
  - Artinya, token lama bisa masih lolos ke render awal halaman tertentu sampai request berikutnya menyentuh validasi `sessionVersion` di server.

### RR-002 - Regression suite keamanan masih terbatas ke source-level checks

- Severity: `Medium`
- Status: `Belum tuntas`
- Ringkasan:
  - Script `npm run security:test` sudah ditambahkan sebagai regression gate ringan.
  - Namun test ini masih berbasis source-level assertions karena keterbatasan runner di environment saat ini.
  - Belum ada end-to-end test untuk flow login, blocked-user, CSRF, dan invalidasi sesi.

## Ringkasan Risiko Serangan Siber Saat Ini

Setelah perbaikan yang sudah diterapkan, risiko yang paling relevan saat ini bergeser menjadi:

1. Penyalahgunaan token lama pada level page gate awal yang hanya melewati `proxy.ts`, sebelum request berikutnya menyentuh validasi `sessionVersion` di server.
2. Regresi keamanan di masa depan jika perubahan auth/redirect/rate-limit tidak disertai test integrasi yang lebih kuat.

## Prioritas Perbaikan Berikutnya

Urutan hardening lanjutan yang paling masuk akal dari kondisi saat ini:

1. Perketat gate halaman privat agar invalidasi sesi juga lebih deterministik sebelum render halaman, bukan hanya di API guard berikutnya.
2. Tambahkan regression test yang benar-benar mengeksekusi flow login, blocked/suspended user, CSRF, role guard, dan safe redirect.
3. Review ulang endpoint sensitif lain untuk throttle berbasis actor dan audit alerting yang lebih kaya.

## Temuan Implementasi dan Catatan Teknis

Beberapa hal penting yang terlihat dari audit kode:

- Sudah ada `npm run security:test` untuk regression check ringan berbasis source code.
- Rate limiter inti sekarang sudah terpusat di database melalui tabel `rate_limit_entries`.
- Seed admin sekarang bergantung pada env bootstrap dan tidak lagi memakai kredensial statis di source code.
- `getUserFromRequest()` masih mendukung fallback header `Authorization: Bearer`, walau alur browser utama sudah dipusatkan ke cookie.
- Dokumentasi lama memiliki beberapa overlap dan masalah encoding; hal itu sekarang disederhanakan ke satu README ini.

## Environment Variable

Variabel yang terlihat dipakai langsung oleh kode:

```env
DATABASE_URL="postgresql://user:password@host:5432/suaka_cuanku"
JWT_SECRET="ganti-dengan-secret-random-yang-kuat"
ALLOWED_ORIGINS="http://localhost:3000"
SESSION_COOKIE_SECURE="false"
TRUST_PROXY_HEADERS="false"
PASSWORD_BREACH_CHECK_MODE="best-effort"
HIBP_RANGE_API_URL="https://api.pwnedpasswords.com/range"
SMTP_HOST="smtp.example.com"
SMTP_PORT="587"
SMTP_USER="smtp-user"
SMTP_PASS="smtp-password"
SMTP_FROM_EMAIL="no-reply@example.com"
SMTP_FROM_NAME="Suaka Cuanku"
SEED_ADMIN_EMAIL="admin@example.com"
SEED_ADMIN_PASSWORD="gunakan-password-bootstrap-yang-kuat"
```

Keterangan:

- `DATABASE_URL`: koneksi PostgreSQL untuk Prisma.
- `JWT_SECRET`: wajib ada agar JWT dapat diverifikasi dengan aman.
- `ALLOWED_ORIGINS`: daftar origin tambahan yang diizinkan, dipisah koma.
- `SESSION_COOKIE_SECURE`: bisa `false` untuk local HTTP; di production HTTPS sebaiknya biarkan aman.
- `TRUST_PROXY_HEADERS`: aktifkan hanya bila aplikasi memang berada di belakang reverse proxy tepercaya yang mengisi header IP dengan benar.
- `PASSWORD_BREACH_CHECK_MODE`: `strict` memblokir pembuatan password bila pengecekan breach gagal; `best-effort` memakai denylist lokal saat layanan breach checker tidak tersedia.
- `HIBP_RANGE_API_URL`: endpoint hash-range untuk verifikasi password breached tanpa mengirim password mentah.
- `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`, `SMTP_FROM_EMAIL`, `SMTP_FROM_NAME`: konfigurasi SMTP.
- `SEED_ADMIN_EMAIL`: email admin bootstrap saat `npm run db:seed`.
- `SEED_ADMIN_PASSWORD`: password admin bootstrap saat `npm run db:seed`.

## Setup Lokal

```bash
npm install
npm run db:generate
npm run db:push
npm run db:seed
npm run dev
```

Agar `npm run db:seed` berhasil, set juga `SEED_ADMIN_EMAIL` dan `SEED_ADMIN_PASSWORD` di `.env`.

Aplikasi akan berjalan di `http://localhost:3000` secara default.

## Scripts

```bash
npm run dev
npm run build
npm run start
npm run lint
npm run security:test
npm run db:generate
npm run db:push
npm run db:seed
npm run db:clear
npm run db:studio
```

## Kredensial Seed

Tidak ada lagi kredensial seed default yang hardcoded di source code.

Admin awal dibuat berdasarkan:

- `SEED_ADMIN_EMAIL`
- `SEED_ADMIN_PASSWORD`

Gunakan password bootstrap yang kuat dan ganti lagi setelah inisialisasi bila diperlukan.

## Kesimpulan

Secara kode, Suaka Cuanku sudah memiliki fondasi web app yang cukup lengkap:

- dashboard multi-role
- route API terpisah per domain
- kontrol limit pinjaman dan status pembayaran
- dokumentasi alur auth berbasis cookie
- audit trail dan pengamanan dasar yang nyata di server

Fondasi keamanan proyek sekarang lebih baik daripada kondisi awal audit. Kerentanan prioritas tertinggi yang terdokumentasi sudah ditutup atau ditekan signifikan, tetapi aplikasi ini masih belum bisa dinyatakan aman sepenuhnya dalam arti absolut. Residual risk yang tersisa sekarang terutama berada pada invalidasi sesi sebelum render halaman dan kedalaman regression test keamanan.
