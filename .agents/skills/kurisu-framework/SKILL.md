---
name: kurisu-framework
description: Engineering rules and architecture for the Kurisu WhatsApp bot. Use before adding or refactoring commands, middlewares, services, events, or AI skills.
---

# Kurisu Framework

Sumber kebenaran utama ada di [`AGENTS.md`](../../../AGENTS.md). Baca file itu dulu.

## Alur

```text
event -> middleware event -> ctx.msg -> command registry -> execute()
```

- `core/` adalah engine; jangan diubah tanpa instruksi eksplisit.
- `app/services/` menyimpan logika domain yang dipakai ulang.
- `app/commands/` dan `app/skills/` harus tipis.

## Aturan cepat

- Import core: `@kurisu/core/...`. Import app: `#app/...`.
- Command: `defineCommand`, metadata Bahasa Indonesia, guard di `middlewares`.
- Guard: `group`, `private`, `sender:isOwner`, `sender:admin,superAdmin,isOwner`, `bot:admin`.
- Cek izin di service/skill: `isOwner(msg)` / `isGroupAdmin(msg)` dari `#app/utils/roles.js`.
- Kode, komentar, log, exception: Inggris. Teks user/AI: Indonesia.
- Jangan pakai em dash atau emoji hiasan.
- Satu aksi = satu service, dipakai command dan skill. Jangan duplikasi.
- `run_bot_command` hanya untuk command aman; guard tetap berlaku; set `ctx.suppressAiReply`.
- Jangan tambah alias/backward-compat atau abstraksi untuk satu pemanggilan.
- Regenerate docs command setelah metadata berubah: `npm run docs:commands`.

Detail command, middleware, dan AI ada di `AGENTS.md`.
