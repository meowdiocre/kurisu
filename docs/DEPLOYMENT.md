# Deployment & Operasional

Panduan ini memakai contoh instalasi di `/opt/kurisu` dengan systemd. Path dan user bisa disesuaikan.

## 1. Prasyarat host

- Linux (Ubuntu 22.04/24.04 atau serupa)
- **Node.js 24+** dan npm
- Git
- FFmpeg (`ffmpeg`, `ffprobe`)
- Build tools (`python3`, `make`, `g++`) untuk native module

```bash
apt-get update
apt-get install -y git ffmpeg python3 python3-venv make g++
```

## 2. Ambil kode dan dependency

```bash
git clone https://github.com/meowdiocre/kurisu.git /opt/kurisu
cd /opt/kurisu
npm install
```

Jika memakai systemd dengan user khusus:

```bash
useradd --system --home-dir /opt/kurisu --shell /usr/sbin/nologin kurisu
chown -R kurisu:kurisu /opt/kurisu
```

## 3. Konfigurasi `.env`

```bash
cp .env.example .env
chmod 600 .env
```

Minimal:

```env
KEY=<random-string>
SESSION_ID=main
DB_CONNECTION=sqlite
DB_DATABASE=kurisu
OWNER_NUMBERS=628xxxxxxxxxx
AI_BASE_URL=https://api.openai.com/v1
AI_API_KEY=
AI_MODEL=gpt-4o-mini
```

Untuk orai/OpenAI-compatible lain, isi `AI_BASE_URL`, `AI_API_KEY`, dan `AI_MODEL` sesuai provider. Pastikan endpoint mendukung tool calling.

## 4. Migrasi database

```bash
node kurisu.js migrate --seed
```

`--seed` hanya membuat baris `bots` awal. Owner diambil dari `OWNER_NUMBERS`. Jika database sudah ada, seed tidak menimpa owner lama.

## 5. Systemd

`/etc/systemd/system/kurisu.service`:

```ini
[Unit]
Description=Kurisu WhatsApp Bot
After=network-online.target
Wants=network-online.target
StartLimitIntervalSec=0

[Service]
Type=simple
User=kurisu
Group=kurisu
WorkingDirectory=/opt/kurisu
Environment=NODE_ENV=production
Environment=PATH=/usr/local/bin:/usr/bin:/bin
ExecStart=/usr/bin/node core/server.js
Restart=always
RestartSec=10
KillSignal=SIGTERM
TimeoutStopSec=20
LimitNOFILE=65535
SyslogIdentifier=kurisu
StandardOutput=journal
StandardError=journal

[Install]
WantedBy=multi-user.target
```

Sesuaikan `ExecStart` dengan lokasi Node (mis. `/opt/node/bin/node`). Lalu:

```bash
systemctl daemon-reload
systemctl enable --now kurisu
systemctl status kurisu
```

## 6. Linking WhatsApp

Saat belum ada sesi, bot membuat QR. Di systemd (non-TTY), QR masuk ke journal:

```bash
journalctl -u kurisu -o cat --no-pager | tail -40
```

Helper opsional `/usr/local/bin/kurisu-qr`:

```sh
#!/bin/sh
journalctl -u kurisu -o cat --no-pager | tac | awk '{print} /Scan the QR code below/{exit}' | tac
```

Scan dari WhatsApp → **Perangkat tertaut → Tautkan perangkat**.

Alternatif pairing code (butuh TTY):

```bash
systemctl stop kurisu
cd /opt/kurisu && node core/server.js
# pilih Pairing Code, masukkan nomor
# setelah connected: Ctrl-C, lalu systemctl start kurisu
```

Sesi disimpan di `storage/` dan dipakai ulang setelah restart.

## 7. Owner

Cek owner aktif:

```bash
sqlite3 /opt/kurisu/storage/database.sqlite "select owners from bots;"
```

Bootstrap/penggantian owner tanpa owner lama:

```bash
sqlite3 /opt/kurisu/storage/database.sqlite \
  "update bots set owners=json_array('628xxxxxxxxxx');"
systemctl restart kurisu
```

Setelah punya owner, gunakan `.owner list`, `.owner set`, dan `.owner del` dari WhatsApp.

## 8. TTS (opsional)

### Edge TTS

```bash
python3 -m venv /opt/tts-venv
/opt/tts-venv/bin/pip install edge-tts
```

`.env`:

```env
TTS_PROVIDER=edge
TTS_REPLY_MODE=auto
TTS_VOICE=id-ID-GadisNeural
TTS_EDGE_BIN=/opt/tts-venv/bin/edge-tts
```

`TTS_REPLY_MODE=auto` mengirim voice note hanya saat user meminta (mis. “bales pake suara”); selain itu teks. Gunakan `voice`/`both` kalau ingin selalu bersuara.

### Fallback downloader (opsional)

```bash
python3 -m venv /opt/ytdlp-venv
/opt/ytdlp-venv/bin/pip install -U yt-dlp
```

`.env`:

```env
YTDLP_BIN=/opt/ytdlp-venv/bin/yt-dlp
# YTDLP_DISABLED=true
```

Urutan downloader: VidsSave, lalu tikwm untuk TikTok, lalu yt-dlp. Kalau yt-dlp tidak tersedia, fallback terakhir dilewati.

### Google TTS

Tidak perlu key:

```env
TTS_PROVIDER=google
TTS_GOOGLE_LANG=id
```

Endpoint tidak resmi; jika gagal, bot fallback ke Edge.

### ElevenLabs

```env
TTS_PROVIDER=elevenlabs
TTS_REPLY_MODE=auto
ELEVENLABS_API_KEY=sk_...
ELEVENLABS_VOICE_ID=cgSgspJ2msm6clMCkdW9
ELEVENLABS_MODEL=eleven_multilingual_v2
```

Free tier tidak bisa memakai library voice (`402 paid_plan_required`). Gunakan voice premade atau provider lain.

Tes setelah restart:

```text
.say test
.say elevenlabs halo aku kurisu
```

## 9. Update & backup

```bash
cd /opt/kurisu
git pull --ff-only
npm install          # jika dependency berubah
systemctl restart kurisu
```

Backup state:

```bash
systemctl stop kurisu
tar -czf /root/kurisu-backup-$(date +%F).tar.gz \
  /opt/kurisu/.env /opt/kurisu/storage
systemctl start kurisu
```

## 10. Operasional harian

```bash
systemctl status kurisu
journalctl -u kurisu -f
journalctl -u kurisu --since "15 min ago" -o cat | grep -E "ERROR|WARN|\[CALL\]|\[TTS\]"
```

Health yang diharapkan di log:

```text
[AUTH] Found saved session "main" (...). Connecting...
Status: connected
Connection established (new login: false)
```

## Troubleshooting

| Gejala | Penyebab umum | Tindakan |
|---|---|---|
| `exit 139` saat start/migrate | ABI `better-sqlite3` vs Node | Pakai Node 24+ |
| QR tidak muncul | Sesi sudah tersimpan | Cek `[AUTH] Found saved session` |
| QR kedaluwarsa | Belum discan dalam masa berlaku | Restart service, ambil QR baru |
| Bot diam di grup | Tidak di-tag/reply | Tag bot atau reply pesannya |
| `no device sessions` saat call | Target tidak punya device | Cek nomor/LID target; bot mencoba LID lalu PN |
| `ELEVENLABS... 402` | Voice library di free tier | Pakai premade voice/Google/Edge |
| `AI_API_KEY is not configured` | `.env` belum diisi | Isi key dan restart |
| TTS gagal | FFmpeg/edge-tts tidak ada | Cek `ffmpeg -version`, path `TTS_EDGE_BIN` |

## Keamanan

- `.env` dan `storage/` berisi kredensial; batasi permission (`600` untuk `.env`).
- Command `eval`, `exec`, `call`, `say`, dan `join/leave` hanya untuk owner.
- Jangan jalankan bot sebagai root jika tidak perlu; gunakan user khusus.
- Rotasi API key yang pernah terekspos.
