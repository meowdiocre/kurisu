# Kurisu Architecture & Engineering Guidelines (`AGENTS.md`)

Dokumen ini adalah pedoman arsitektur dan standar rekayasa software untuk bot **Kurisu (Architecture v2)**. Setiap agen AI dan developer yang berkontribusi pada repositori ini **WAJIB** tunduk pada prinsip di bawah ini tanpa pengecualian.

> [!IMPORTANT]
>
> ### 🚨 Mandatory Directives for AI Agents:
>
> 1. **Panggilan ke Core WAJIB Melalui `@kurisu/core`:**
>    - Jangan pernah menggunakan alias `#` (`#services/...`, `#utils/...`, dll) ataupun path relatif antar-layer (`../../core/...`) untuk modul core.
>    - Semua berkas (baik di dalam `app/`, root `kurisu.js`, maupun antar-berkas di dalam `core/`) **HARUS SELALU** mengimpor dari `@kurisu/core/...`.
> 2. **Log, Error Teknis, dan Komentar WAJIB Bahasa Inggris; Teks User-Facing WAJIB Bahasa Indonesia:**
>    - Seluruh logging (`logger.info`, `logger.warn`, `logger.error`, `logger.debug`), exception error (`throw new Error(...)`), komentar teknis, dan identifier kode **HARUS Bahasa Inggris**.
>    - Teks yang dilihat pengguna (balasan command, `description` command/menu, guard, error yang dikirim ke WhatsApp) dan dokumentasi **WAJIB Bahasa Indonesia**.
> 3. **Batasan Mutlak Direktori `core/` (Engine Core Boundary):**
>    - Direktori `core/` adalah engine framework internal murni (_agnostic event-driven engine_). **DILARANG KERAS** membuat berkas baru atau mengubah kode di dalam `core/` kecuali jika diperintahkan secara eksplisit oleh pengguna. Seluruh logika aplikasi, bot commands, message gateway, middleware, helper, dan service aplikasi harus diletakkan di dalam folder `app/`.
> 4. **Event Handlers Terorganisir (`app/events/<eventName>/*.js`):**
>    - `app/events/` diorganisir per subfolder event WhatsApp (contoh: `app/events/message/commands.js`, `app/events/group/cleanup-database.js`, `app/events/group/sync-cache.js`).
>    - `app/events/message/commands.js` bertindak sebagai message gateway yang memfilter stub/broadcast, mem-parsing `ctx.msg`, menjalankan middleware event, dan mendispatch ke command registry.
>    - Middleware event didaftarkan secara eksplisit dan scoped di `app/starts/kernel.js` (`eventMiddlewares.message`, dll).
> 5. **Command Registry & Parameterized Middleware Guards (`app/services/bot`):**
>    - Seluruh fitur bot diletakkan di `app/commands/<category>/<name>.js` menggunakan `defineCommand` dari `#app/services/bot`.
>    - Guard standar (`'group'`, `'private'`, `'sender:<roles>'`, `'bot:<roles>'`) disediakan bawaan oleh `#app/services/bot`. Tidak perlu mendefinisikan file middleware di `app/middlewares/` untuk guard standar ini!
>    - Validasi hak akses **WAJIB** menggunakan parameterized middlewares di properti `middlewares: [...]` (contoh: `['group', 'sender:admin,superAdmin,isOwner', 'bot:admin']`).
> 6. **Pesan Penolakan Ringkas (Concise Guard Messages):**
>    - Jika terjadi kegagalan validasi hak akses, gunakan pesan penolakan yang ultra-ringkas dan to-the-point (`Khusus owner!`, `Khusus admin!`, `Hanya bisa di grup!`, `Bot bukan admin!`). Jangan membanjiri chat WhatsApp dengan pesan penolakan yang panjang dan bertele-tele.
> 7. **DILARANG Auto-Commit Git & DILARANG Suggestion Commit Otomatis:**
>    - AI Agent **DILARANG KERAS** menjalankan perintah `git commit` atau membuat commit secara otomatis (_"biar dev-nya aja yang commit"_).
>    - AI Agent juga **DILARANG** menyertakan rekomendasi/suggestion pesan commit (_suggested Conventional Commit message_) di akhir respons kecuali jika diminta secara eksplisit oleh developer.
> 8. **DILARANG Menambahkan Inisiatif Alias / Bloat Tanpa Izin:**
>    - Jangan pernah berinisiatif membuat alias (fungsi, variabel, atau properti seperti `tableMember`, `getBotSettings`, dll) demi backward compatibility tanpa meminta pendapat/persetujuan developer terlebih dahulu. Buat perubahan langsung, bersih, dan tanpa redundansi untuk menjaga kode tidak gemuk (_no bloat_) dan mudah dimaintain.
> 9. **DILARANG Menggunakan Emoji Slop & Standar Format Pesan Bersih (No Emoji Slop):**
>    - **DILARANG KERAS** menggunakan emoji berlebihan atau emoji hiasan murahan/slop (contoh: ⚙️, 👑, ✅, 🗑️, 💡, 👋, 🚀, dll) dalam respon chat WhatsApp bot.
>    - Format output WhatsApp **WAJIB** rapi, minimalis, dan elegan menyerupai format `menu.js`:
>      - Gunakan header bracket `｢ *title* ｣` atau `*TITLE*`.
>      - Gunakan bullet point simpel `• \`item\`` untuk daftar.
>      - Gunakan monospace backticks untuk perintah atau parameter (`\`prefix add <simbol>\``).
>      - Hindari dekorasi simbol berulang-ulang yang mengotori layar pengguna.
> 10. **Standar Penyimpanan Identitas WhatsApp di Database (Full JID dengan `@`):**
>
> - WhatsApp v2 bekerja dengan dua jenis identitas: **Phone Number (PN)** (`@s.whatsapp.net`) dan **LID** (`@lid`).
> - Seluruh data identitas pengguna yang disimpan ke tabel database (seperti `group_members.user_pn` dan `group_members.user_lid`) **WAJIB menggunakan Full JID lengkap beserta domainnya** (contoh: `628123456789@s.whatsapp.net` untuk PN, dan `198414771982429@lid` untuk LID).
> - **DILARANG** memotong domain `@s.whatsapp.net` atau `@lid` saat menyimpan ke database agar tipe identitas selalu jelas, terbedakan, dan tidak ambigu saat berinteraksi dengan API native Zapo/WhatsApp.
> 10. **Standar Penyimpanan Identitas WhatsApp di Database (Full JID dengan `@`):**
>    - WhatsApp v2 bekerja dengan dua jenis identitas: **Phone Number (PN)** (`@s.whatsapp.net`) dan **LID** (`@lid`).
>    - Seluruh data identitas pengguna yang disimpan ke tabel database (seperti `group_members.user_pn` dan `group_members.user_lid`) **WAJIB menggunakan Full JID lengkap beserta domainnya** (contoh: `628123456789@s.whatsapp.net` untuk PN, dan `198414771982429@lid` untuk LID).
>    - **DILARANG** memotong domain `@s.whatsapp.net` atau `@lid` saat menyimpan ke database agar tipe identitas selalu jelas, terbedakan, dan tidak ambigu saat berinteraksi dengan API native Zapo/WhatsApp.

---

## 1. Filosofi Utama: Architecture v2

1. **Separation of Concerns:**
   - **`core/` (Agnostic Framework Engine):** Hanya menangani koneksi WhatsApp (Zapo), event bus, database (Knex), cache (LRU), environment, modular loader, dan CLI. Bersih dari logika bot perintah teks.
   - **`app/services/bot/` (Bot Engine & Utilities):** Message parser (`parseMessage`), command validator, command registry dengan instant $O(1)$ dispatching, built-in guards (`sender`, `bot`, `group`, `private`), dan formatter menu.
   - **`app/events/message/commands.js` (Message Gateway):** Menerima event native `message`, memfilter stub/broadcast, menyiapkan `ctx.msg`, menjalankan middleware event, lalu mendispatch ke command registry.
   - **`app/events/<eventName>/*.js` (Custom Events):** Handler event aplikasi untuk event WhatsApp lainnya (misal sinkronisasi grup).
   - **`app/middlewares/*.js` (App Middlewares):** Middleware logika bisnis spesifik userland (contoh: `bot-table.js`, `group-table.js`, `group-mode.js`, `group-score.js`).
   - **`app/commands/<category>/*.js` (Commands):** Logika bisnis murni command bot.
2. **Type Safety & Context Extensibility:**
   - Seluruh payload memiliki tipe yang kuat dan scoped.
   - Properti custom pada `ctx` (seperti `ctx.msg`, `ctx.tableBot`, `ctx.tableGroup`, `ctx.tableGroupMember`) didefinisikan di `app/types/context.d.ts` menggunakan TypeScript module augmentation.

---

## 2. Struktur Direktori Aplikasi (`app/`)

```text
kurisu/
├── core/                         # Engine & Framework (@kurisu/core package - Pure Agnostic)
│   ├── services/                 # Core engine (whatsapp, database, env, modules, cli, starts, cache)
│   └── utils/                    # Pure helpers (logger, path, storage, common, dll)
├── app/                          # Userland Application Logic
│   ├── types/                    # Userland Context Augmentation
│   │   └── context.d.ts          # ctx.msg, ctx.tableBot, ctx.tableGroup, ctx.tableGroupMember
│   ├── starts/                   # Application startup lifecycle
│   │   ├── index.js              # AdonisJS-style application hooks (app.use, app.server, app.terminal)
│   │   └── kernel.js             # Userland event middlewares & custom command middleware aliases
│   ├── middlewares/              # Userland middlewares
│   │   ├── bot-table.js          # Inject ctx.tableBot dari database/cache
│   │   ├── bot-ignore.js         # Filter stub/broadcast, parse ctx.msg, set ctx.command
│   │   ├── bot-mode.js           # Mode public/self
│   │   ├── group-table.js        # Group & member records (ctx.tableGroup, ctx.tableGroupMember)
│   │   ├── group-mode.js         # Group botAccess policy guard ('everyone' vs 'admin')
│   │   ├── group-score.js        # Debounced group member interaction scoring
│   │   └── bot-guards.js         # Command guards (sender, bot, group, private)
│   ├── events/                   # Dedicated Native Event Subdirectories
│   │   ├── message/
│   │   │   └── commands.js       # WhatsApp message command dispatcher
│   │   └── group/
│   │       ├── cleanup-database.js Purge records on bot departure or member kick
│   │       └── sync-cache.js     # Invalidate and refresh group metadata cache
│   ├── commands/                 # Declarative Bot Commands
│   │   ├── downloader/           # Media downloader (dl)
│   │   ├── group/                # Group management (kick, warn, blockword, summary, dll)
│   │   ├── maker/                # Sticker tools (sticker, take, toimg)
│   │   ├── owner/                # Owner tools (eval, exec, call, say, owner, prefix, dll)
│   │   └── utility/              # Utility (menu, ping, note, reminder)
│   ├── services/
│   │   ├── ai/                   # Client, persona, prompt builder, persona modes
│   │   ├── bot/                  # Command registry, message parser, menu builder, dispatcher
│   │   ├── call.js               # Resolusi target + miscall (LID/PN)
│   │   ├── tts.js                # Edge/Google/ElevenLabs TTS + cache
│   │   ├── sticker.js            # Konversi media ke stiker
│   │   ├── note.js               # Catatan pribadi/grup
│   │   └── reminder.js           # Reminder + miscall terjadwal
│   ├── skills/                   # AI tool/skill definitions (sticker, reminder, call, notes, dll)
│   └── database/                 # Migrations & Seeds
├── docs/                         # Dokumentasi (COMMANDS.md, DEPLOYMENT.md)
├── scripts/                      # Utility scripts (command-docs.js)
├── storage/                      # SQLite DB, session WhatsApp, temp storage
├── kurisu.js                     # Centralized Kurisu CLI runner
├── README.md                     # Panduan proyek
└── AGENTS.md                     # Dokumen ini
```

---

## 3. Konvensi Import Alias

1. **Memanggil Core:**
   - **WAJIB** menggunakan package specifier `@kurisu/core/...`.
   - ✅ `import logger from '@kurisu/core/utils/logger';`
   - ✅ `import db from '@kurisu/core/services/database';`
   - ✅ `import cache from '@kurisu/core/services/cache';`
   - ✅ `import { defineModule } from '@kurisu/core/services/modules';`
2. **Memanggil App Modules:**
   - Gunakan Subpath Import `#app/...`.
   - ✅ `import { defineCommand } from '#app/services/bot/index.js';`
   - ✅ `import { getGroupMetadata, clearGroupMetadataCache } from '#app/services/bot/index.js';`
   - ✅ `import { checkIsOwner } from '#app/services/bot/index.js';`

---

## 4. Kernel & Middleware Pipeline (`app/starts/kernel.js`)

Userland middleware didaftarkan secara deklaratif di `app/starts/kernel.js`:

```javascript
// app/starts/kernel.js
export const eventMiddlewares = {
  message: [
    () => import('#app/middlewares/bot-table.js'),
    () => import('#app/middlewares/bot-ignore.js'),
    () => import('#app/middlewares/bot-mode.js'),
    () => import('#app/middlewares/bot-shortcut.js'),
    () => import('#app/middlewares/group-table.js'),
    () => import('#app/middlewares/group-score.js'),
    () => import('#app/middlewares/group-blockwords.js'),
    () => import('#app/middlewares/group-status.js'),
    () => import('#app/middlewares/group-recorder.js'),
    () => import('#app/middlewares/group-mode.js'),
    () => import('#app/middlewares/kurisu-chat.js'),
  ],
}

/**
 * Command middleware aliases mapped to app/middlewares/bot-guards.js
 */
export const middlewareAliases = {
  sender: () =>
    import('#app/middlewares/bot-guards.js').then((m) => m.senderGuard),
  bot: () => import('#app/middlewares/bot-guards.js').then((m) => m.botGuard),
  group: () =>
    import('#app/middlewares/bot-guards.js').then((m) => m.groupOnlyGuard),
  private: () =>
    import('#app/middlewares/bot-guards.js').then((m) => m.privateOnlyGuard),
}
```

---

## 5. Standar Menulis Bot Command (`app/commands/<category>/<name>.js`)

Gunakan fungsi `defineCommand` yang mengekspor objek definisi perintah:

```javascript
// app/commands/group/kick.js
import { defineCommand } from '#app/services/bot/index.js'

export default defineCommand({
  name: 'kick',
  aliases: ['kick'],
  category: 'group',
  description: 'Keluarkan member grup lewat tag atau reply',
  usage: 'kick <@tag|reply> [alasan]',
  examples: ['kick @member', '(reply) kick spam'],

  // Parameterized middleware guards (auto-resolved by bot service):
  middlewares: ['group', 'sender:admin,superAdmin', 'bot:admin'],

  async execute(payload, ctx) {
    const { client, msg } = ctx

    // Command logic goes here!
    // No need for manual isCommand() or permission checking.
    await msg.reply('Member berhasil dikeluarkan.')
  },
})
```

### Opsi Definisi Command:

- **`name`** (string): Nama unik pengenal modul/perintah (contoh: `'kick'`, `'ping'`). Hanya sebagai unique identifier metadata, **BUKAN trigger command**.
- **`aliases`** (string[]): Daftar trigger command yang dapat dieksekusi pengguna di WhatsApp (contoh: `['kick']`, `['ping']`, `['menu', 'help']`, `['>', '>>']`).
- **`category`** (string): Kategori perintah untuk pengelompokan menu (contoh: `'group'`, `'utility'`, `'owner'`).
- **`description`** (string): Deskripsi singkat **Bahasa Indonesia** yang tampil di menu dan docs.
- **`usage`** (string, opsional): Pola pemakaian **tanpa prefix** (contoh: `call <nomor|@tag|reply> [detik]`).
- **`examples`** (string[], opsional): Contoh perintah **tanpa prefix**.
- **`hidden`** (boolean, opsional): Sembunyikan command internal dari menu dan docs.
- **`middlewares`** (string[]): Daftar guard middleware (contoh: `['group', 'sender:isOwner']`).
- **`prefix`** (`boolean | 'optional'`):
  - `true` (default): Wajib diawali prefix bot.
  - `false`: Dilarang menggunakan prefix (contoh: `>`, `$`).
  - `'optional'`: Dapat dieksekusi dengan atau tanpa prefix.
- **`execute`** (`(payload, ctx) => Promise<void>`): Handler fungsi eksekusi perintah.

---

## 6. Built-in Parameterized Middleware Guards

Bot service framework secara otomatis menyediakan 4 guard bawaan:

1. **`sender:<role1>,<role2>`**:
   - Memastikan pengirim memiliki setidaknya salah satu peran yang diminta (`admin`, `superAdmin`, `isOwner`).
   - Contoh: `'sender:isOwner'`, `'sender:admin,superAdmin'`, `'sender:admin,superAdmin,isOwner'`.
   - Pesan penolakan otomatis: `'Khusus owner!'` (jika hanya owner) atau `'Khusus admin!'`.
2. **`bot:<role>`**:
   - Memastikan bot memiliki hak akses (`bot:admin`).
   - Pesan penolakan otomatis: `'Bot bukan admin!'`.
3. **`group`**:
   - Memastikan perintah dieksekusi di dalam grup WhatsApp.
   - Pesan penolakan otomatis: `'Hanya bisa di grup!'`.
4. **`private`**:
   - Memastikan perintah dieksekusi di chat pribadi (bukan grup).
   - Pesan penolakan otomatis: `'Hanya bisa di chat pribadi!'`.

---

## 7. Standar Logging & Error Handling (100% English)

- Semua log terminal, pesan exception, dan komentar kode **WAJIB Bahasa Inggris**:
  - ✅ `logger.info('[REGISTRY]', 'Loaded 11 commands');`
  - ✅ `throw new Error('Chat JID is required');`
  - ❌ `logger.info('[BOT]', 'Memuat perintah bot');` (DILARANG!)

---

## 8. Bahasa, Menu, dan Dokumentasi

### 8.1 Aturan bahasa

- **Teks yang dilihat pengguna** (balasan command, deskripsi menu, guard, error yang dikirim ke WhatsApp) **WAJIB Bahasa Indonesia**.
- **Kode, identifier, nama file, komentar teknis, log, dan exception** tetap **Bahasa Inggris** agar konsisten dengan core.
- Dokumentasi (`README.md`, `docs/*.md`, `AGENTS.md`) memakai **Bahasa Indonesia**.
- Hindari mencampur dua bahasa dalam satu kalimat user-facing.

### 8.2 Metadata command

Setiap command wajib punya `description` Bahasa Indonesia. Untuk command yang punya argumen/subcommand, tambahkan:

```javascript
description: 'Telepon nomor WhatsApp selama N detik (owner)',
usage: 'call <nomor|@tag|reply> [detik]',
examples: ['call 628123456789 5', 'call aku 30'],
```

- `usage` dan `examples` **tanpa prefix**; menu menambahkan prefix aktif.
- Command internal/debug gunakan `hidden: true` agar tidak muncul di menu/docs.

### 8.3 Menu dan docs

- Menu dihasilkan dari metadata registry (`app/services/bot/menu.js`):
  - `menu` → semua command + deskripsi.
  - `menu <kategori>` → filter kategori.
  - `menu <command>` → detail command + usage + contoh.
  - `menu command <nama>` → detail command yang namanya sama dengan kategori.
- Jangan hardcode daftar command di dokumen. Regenerate:

```bash
npm run docs:commands
```

- Dokumentasi deploy ada di `docs/DEPLOYMENT.md`, ringkasan proyek di `README.md`.

### 8.4 Verifikasi perubahan

- Jalankan `node --check` untuk file yang diubah.
- Untuk perubahan command/menu, verifikasi dengan memuat registry dan memanggil `formatMenuText` (lihat `scripts/command-docs.js`).
- Untuk perubahan perilaku bot, uji jalur nyata (atau stub client seperti saat menguji `call_number`/TTS) sebelum deploy.
- Setelah `git pull` di server, jalankan `systemctl restart kurisu` dan cek log `ERROR`/`WARN`.
