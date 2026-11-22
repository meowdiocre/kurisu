# Kurisu

Bot WhatsApp berbasis Node.js dengan AI chat, manajemen grup, catatan, pengingat, stiker, downloader, miscall, dan balasan voice note (TTS).

Fork dari [`ilsyaa/nakiri`](https://github.com/ilsyaa/nakiri), di-rebrand dan dikembangkan sebagai **Kurisu**.

## Fitur

- **AI chat**: persona Kurisu, memory per chat, tool calling, dan fallback `[NO_REPLY]`.
- **AI skills**: stiker, download media, reminder, info grup/member, catatan, dan miscall (owner).
- **Voice note**: balasan AI bisa diucapkan lewat TTS (Edge, Google, atau ElevenLabs).
- **Grup**: welcome/goodbye, kick/warn, blockword, leaderboard, rangkuman AI, dan mode akses bot.
- **Utility**: catatan pribadi/grup, reminder (termasuk miscall), ping, menu.
- **Owner**: eval/exec, join/leave, owner/prefix/shortcut/persona, miscall, dan TTS manual.
- **Session persisten**: kredensial WhatsApp disimpan di `storage/`, tidak perlu scan ulang setelah restart.
- **SQLite default**: bisa diganti MySQL lewat env.

## Stack

- Node.js (disarankan **Node 24+**; `better-sqlite3` bisa segfault di Node 20/22)
- `zapo-js` untuk WhatsApp Web
- Knex + SQLite/MySQL
- FFmpeg (stiker, audio)
- `edge-tts` (opsional) dan ElevenLabs API (opsional) untuk voice note

## Menjalankan

```bash
git clone git@github.com:t101804/kurisu.git
cd kurisu
npm install
cp .env.example .env

# isi minimal: KEY, AI_BASE_URL, AI_API_KEY, AI_MODEL
node kurisu.js migrate --seed
npm start
```

Saat pertama kali jalan, bot meminta QR atau pairing code di terminal. Di server non-interaktif, QR ditulis ke journal/log; lihat [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md).

## Konfigurasi

Semua konfigurasi lewat `.env`. Tabel lengkap ada di [.env.example](.env.example); yang penting:

| Env | Wajib | Keterangan |
|---|---|---|
| `KEY` | ya | Validasi startup |
| `DB_CONNECTION` | ya | `sqlite` atau `mysql` |
| `OWNER_NUMBERS` | tidak | Nomor owner (pisahkan koma) untuk seed database baru |
| `AI_BASE_URL` / `AI_API_KEY` / `AI_MODEL` | untuk AI | Endpoint OpenAI-compatible |
| `TAVILY_API_KEY` | tidak | Mengaktifkan tool pencarian web |
| `TTS_REPLY_MODE` | tidak | `off`, `auto` (default), `voice`, atau `both` |
| `TTS_PROVIDER` | tidak | `edge`, `google`, atau `elevenlabs` |
| `ELEVENLABS_API_KEY` | tidak | Diperlukan untuk provider `elevenlabs` |

Owner tidak diatur lewat env saat runtime. Untuk database baru, isi `OWNER_NUMBERS` sebelum seed, atau ubah kolom `bots.owners` langsung. Setelah punya owner, gunakan `.owner set`.

## Command

Daftar lengkap dan usage: [docs/COMMANDS.md](docs/COMMANDS.md) (digenerate dari metadata command).

```bash
npm run docs:commands   # regenerate docs/COMMANDS.md
```

Di WhatsApp:

```text
.menu                    # semua fitur
.menu owner              # filter kategori
.menu call               # detail satu command
.menu command owner      # detail command bernama sama dengan kategori
```

Command owner yang sering dipakai:

```text
.call 628123456789 10     # miscall 10 detik
.say test                 # bandingkan suara edge/google/elevenlabs
.say elevenlabs halo      # voice note manual
.owner list
```

## AI & Skill

Endpoint AI harus OpenAI-compatible dan mendukung tool calling. Skill yang terdaftar:

- `create_sticker`, `download_media`
- `call_number` (owner)
- `create_reminder`, `list_reminders`, `cancel_reminder`
- `get_group_info`, `get_member_info`
- `save_note`, `get_note`, `list_notes`, `delete_note`

Di grup, AI hanya merespons saat bot di-tag atau pesannya reply ke bot. Di DM, semua pesan non-command diproses.

## TTS

| Provider | Kualitas | Catatan |
|---|---|---|
| `edge` | neural, gratis | Butuh `edge-tts` di host |
| `google` | natural, gratis | Endpoint tidak resmi, bisa kena limit |
| `elevenlabs` | paling manusiawi | Butuh API key; free tier tidak bisa memakai library voice |

Mode balasan (`TTS_REPLY_MODE`):

- `auto` (default): teks untuk balasan normal; voice note hanya saat user minta suara (“bales pake suara”, “kirim voice note”).
- `off`: selalu teks.
- `voice`: selalu voice note.
- `both`: teks lalu voice note.

Contoh setup ElevenLabs:

```env
TTS_PROVIDER=elevenlabs
TTS_REPLY_MODE=auto
ELEVENLABS_API_KEY=sk_...
ELEVENLABS_VOICE_ID=cgSgspJ2msm6clMCkdW9
ELEVENLABS_MODEL=eleven_multilingual_v2
```

## Dokumentasi

- [docs/COMMANDS.md](docs/COMMANDS.md): daftar command, alias, usage, akses.
- [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md): deploy systemd, QR, owner bootstrap, TTS, troubleshooting.
- [AGENTS.md](AGENTS.md): arsitektur dan aturan kontribusi.

## Troubleshooting singkat

- **Bot tidak membalas di grup**: pastikan bot di-tag atau pesan me-reply pesan bot. Teks yang diawali nama command tanpa prefix tidak lagi memblokir AI.
- **`better-sqlite3` exit 139**: ganti ke Node 24+.
- **QR kedaluwarsa**: restart service lalu ambil QR terbaru dari journal.
- **Miscall gagal `no device sessions`**: target tidak punya device WhatsApp yang bisa dihubungi; bot mencoba LID lalu PN.
- **ElevenLabs 402 `paid_plan_required`**: voice library butuh plan berbayar; gunakan voice premade atau provider Google/Edge.

## Lisensi & atribusi

Proyek ini adalah fork dari `ilsyaa/nakiri` (ISC). Pertahankan atribusi ke proyek asli saat mempublikasikan turunan.
