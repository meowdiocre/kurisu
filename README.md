# Kurisu

Bot WhatsApp Node.js dengan AI chat, manajemen grup, catatan, pengingat, stiker, downloader, miscall, dan voice note.

Fork dari [`ilsyaa/nakiri`](https://github.com/ilsyaa/nakiri), di-rebrand dan dikembangkan sebagai **Kurisu**.

## Mulai cepat

```bash
git clone git@github.com:t101804/kurisu.git
cd kurisu
npm install
cp .env.example .env

# isi minimal: KEY, AI_BASE_URL, AI_API_KEY, AI_MODEL
node kurisu.js migrate --seed
npm start
```

Saat pertama jalan, bot meminta QR atau pairing code. Di server non-interaktif, QR ditulis ke journal; lihat [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md).

## Fitur

- **AI chat**: persona Kurisu, memory per chat, tool calling, fallback `[NO_REPLY]`.
- **AI tools**: stiker, download media, reminder, info grup/member, catatan, miscall, dan command runner aman.
- **Voice note**: Edge, Google, atau ElevenLabs.
- **Grup**: welcome/goodbye, kick/warn, blockword, leaderboard, rangkuman, mode akses.
- **Utility**: catatan pribadi/grup, reminder, ping, menu.
- **Owner**: eval/exec, join/leave, owner/prefix/shortcut/persona, miscall, TTS manual.
- **Persisten**: sesi WhatsApp di `storage/`; SQLite default, MySQL opsional.

## Konfigurasi inti

Semua env ada di [.env.example](.env.example).

| Env | Wajib | Keterangan |
|---|---|---|
| `KEY` | ya | Validasi startup |
| `DB_CONNECTION` | ya | `sqlite` atau `mysql` |
| `AI_BASE_URL` / `AI_API_KEY` / `AI_MODEL` | untuk AI | Endpoint OpenAI-compatible |
| `OWNER_NUMBERS` | tidak | Nomor owner untuk seed database baru |
| `TAVILY_API_KEY` | tidak | Tool pencarian web |
| `TTS_REPLY_MODE` | tidak | `off`, `auto`, `voice`, `both` |
| `TTS_PROVIDER` | tidak | `edge`, `google`, `elevenlabs` |
| `ELEVENLABS_API_KEY` | tidak | Provider ElevenLabs |

Owner runtime diatur lewat `.owner set` atau kolom `bots.owners`. Untuk database baru, isi `OWNER_NUMBERS` sebelum seed.

## Command

```bash
npm run docs:commands   # regenerate docs/COMMANDS.md
```

```text
.menu                    # semua fitur
.menu owner              # filter kategori
.menu call               # detail satu command
```

Daftar lengkap: [docs/COMMANDS.md](docs/COMMANDS.md).

## AI

Endpoint AI harus OpenAI-compatible dan mendukung tool calling. Tool yang terdaftar:

`create_sticker`, `download_media`, `run_bot_command`, `call_number`, `create_reminder`, `list_reminders`, `cancel_reminder`, `get_group_info`, `get_member_info`, `save_note`, `get_note`, `list_notes`, `delete_note`.

`run_bot_command` menjalankan command aman dengan guard yang sama seperti manual: kick, warn, gmode, blockword, welcome, goodbye, board, member, summary, note, gnote, reminder, sticker, take, toimg, download, menu, ping.

`eval`, `exec`, `owner`, `prefix`, `shortcut`, `persona`, `mode`, `join`, `leave`, `randkick`, `call`, dan `say` tidak diekspos ke AI; jalankan manual oleh owner.

Downloader memakai VidsSave, lalu fallback tikwm (TikTok) dan yt-dlp. Stiker bisa langsung dibuat dari link TikTok/Instagram/YouTube.

Di grup, AI merespons saat bot di-tag atau pesannya reply ke bot. Di DM, semua pesan non-command diproses.

## Dokumentasi

- [docs/COMMANDS.md](docs/COMMANDS.md): command, alias, usage, akses.
- [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md): systemd, QR, owner, TTS, troubleshooting.
- [AGENTS.md](AGENTS.md): arsitektur dan aturan kontribusi.

## Catatan

- Gunakan **Node 24+**; `better-sqlite3` bisa segfault di Node 20/22.
- FFmpeg wajib untuk stiker/audio. `edge-tts` dan `yt-dlp` opsional.
- QR kedaluwarsa: restart service, ambil QR terbaru dari journal.
- Miscall `no device sessions`: target tidak punya device WhatsApp yang bisa dihubungi.
- ElevenLabs 402: voice library butuh plan berbayar; pakai voice premade atau Edge/Google.

## Lisensi

Fork dari `ilsyaa/nakiri` (ISC). Pertahankan atribusi proyek asli saat mempublikasikan turunan.
