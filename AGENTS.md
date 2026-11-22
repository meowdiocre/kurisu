# AGENTS.md

Pedoman singkat untuk berkontribusi di **Kurisu**. Baca ini sebelum mengubah kode.

## Arsitektur

- `core/` = engine framework agnostik: WhatsApp, event bus, database, cache, env, CLI. Jangan ubah tanpa instruksi eksplisit.
- `app/events/` = gateway event WhatsApp. `app/events/message/commands.js` memproses pesan dan memanggil registry.
- `app/middlewares/` = middleware event dan guard command.
- `app/services/` = logika domain yang dipakai ulang oleh command, event, dan skill.
- `app/commands/<kategori>/` = command deklaratif.
- `app/skills/` = tool AI. Skill tipis; logika bisnis ada di `app/services/`.

Alur pesan:

```text
event WhatsApp -> middleware event -> parse ctx.msg -> command registry -> command.execute()
```

## Struktur penting

```text
app/
├── commands/        command per kategori
├── events/          gateway event
├── middlewares/     guard dan event middleware
├── services/
│   ├── ai/          client, persona, prompt, tool registry
│   ├── bot/         parser, registry, menu, guards
│   ├── group-member.js  lookup member grup (PN/LID/JID)
│   ├── downloader-media.js
│   ├── sticker.js
│   └── ...
├── skills/          tool AI
├── utils/           helper kecil: roles, time, target, pattern, note-input
└── database/        migration dan seeder
```

## Import

- Core: selalu `@kurisu/core/...`.
- App: selalu `#app/...`.
- Helper lokal satu folder boleh relatif (`./note-context.js`).

```js
import db from '@kurisu/core/services/database';
import { defineCommand } from '#app/services/bot/index.js';
import { isGroupAdmin } from '#app/utils/roles.js';
```

## Command

```js
import { defineCommand } from '#app/services/bot/index.js';

export default defineCommand({
  name: 'kick',
  aliases: ['kick'],
  category: 'group',
  description: 'Keluarkan member grup lewat tag atau reply',
  usage: 'kick <@tag|reply> [alasan]',
  examples: ['kick @member', '(reply) kick spam'],
  middlewares: ['group', 'sender:admin,superAdmin', 'bot:admin'],

  async execute(payload, ctx) {
    const { msg } = ctx;
    await msg.reply('Member dikeluarkan.');
  },
});
```

- `name` = identitas unik, bukan trigger.
- `aliases` = trigger WhatsApp.
- `description` = Bahasa Indonesia, tampil di menu/docs.
- `usage`/`examples` tanpa prefix.
- `hidden: true` untuk command internal.
- Logika yang dipakai command + skill harus masuk `app/services/`.

## Guard

Gunakan guard bawaan, jangan cek izin manual:

- `group`, `private`
- `sender:isOwner`
- `sender:admin,superAdmin,isOwner`
- `bot:admin`

Pesan penolakan singkat: `Khusus owner!`, `Khusus admin!`, `Hanya bisa di grup!`, `Bot bukan admin!`.

Untuk pengecekan izin di dalam service/skill, pakai `isOwner(msg)` dan `isGroupAdmin(msg)` dari `#app/utils/roles.js`.

## AI skill

- Satu aksi = satu service + command + skill. Jangan duplikasi logika.
- Tool result dikembalikan ke AI dalam Bahasa Indonesia, singkat dan faktual.
- `run_bot_command` hanya untuk command aman di `ALLOWED_COMMANDS`; guard command tetap berlaku.
- Set `ctx.suppressAiReply = true` setelah command yang sudah membalas.
- Jangan tambahkan `eval`, `exec`, `owner`, `prefix`, `shortcut`, `persona`, `mode`, `join`, `leave`, `randkick`, `call`, `say` ke AI.
- Skill baru: daftarkan di `app/skills/index.js`, tambahkan aturan singkat di persona jika perlu.

## Bahasa dan output

- Kode, komentar teknis, log, dan exception: Bahasa Inggris.
- Teks untuk user dan AI: Bahasa Indonesia.
- Jangan campur dua bahasa dalam satu kalimat user-facing.
- Jangan pakai em dash atau emoji hiasan. Output WhatsApp rapi dan minimal.
- Format daftar: `• \`item\``; header: `｢ *judul* ｣`.

## Reuse dan YAGNI

- Cek helper yang sudah ada sebelum membuat baru: `roles.js`, `time.js`, `target.js`, `group-member.js`, `pattern.js`, `note-input.js`.
- Abstraksi hanya jika dipakai minimal dua tempat atau menyembunyikan detail penting.
- Jangan tambah alias/backward-compat tanpa persetujuan.
- Jangan buat service baru untuk satu pemanggilan.
- Hapus kode yang sudah tidak dipakai; jangan biarkan komentar atau file mati.

## Verifikasi

```bash
node --check path/file.js
npm run docs:commands        # jika metadata command berubah
```

- Perubahan command/menu: muat registry dan cek hasil `formatMenuText`.
- Perubahan perilaku: uji jalur nyata atau stub client.
- Deploy: `git pull`, `systemctl restart kurisu`, cek `journalctl -u kurisu | grep ERROR`.

## Dokumentasi

- `README.md` = ringkasan dan mulai cepat.
- `docs/COMMANDS.md` = generated; jangan edit manual.
- `docs/DEPLOYMENT.md` = operasional server.
- Jangan hardcode daftar command di dokumen; regenerate.
