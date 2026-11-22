# Daftar Command Kurisu

> Digenerate otomatis dari metadata command. Jangan edit manual.
> Regenerate dengan `npm run docs:commands`.

Prefix default: `.`. Prefix bisa diubah lewat `.prefix`.
Total: **30** command.

## downloader

| Command | Alias | Usage | Akses | Deskripsi |
|---|---|---|---|---|
| `.download` | `.download`, `.dl` | `.download <url>` | semua | Unduh video, audio, atau gambar dari URL yang didukung |

## group

| Command | Alias | Usage | Akses | Deskripsi |
|---|---|---|---|---|
| `.blockword` | `.blockword`, `.badword` | `.blockword <list\|add\|del\|reset> [kata]` | admin/owner | Kelola kata terlarang dan pola filter link di grup (admin) |
| `.board` | `.board` | `.board` | semua | Tampilkan 10 member grup paling aktif |
| `.gmode` | `.gmode` | `.gmode <everyone\|admin>` | admin/owner | Atur siapa yang boleh memakai bot di grup (semua vs admin) |
| `.gnote` | `.gnote`, `.gnotes` | `.gnote <list\|add\|del\|get> [nama]` | semua | Simpan dan baca catatan bersama di grup |
| `.goodbye` | `.goodbye` | `.goodbye [on\|off]` | admin/owner | Aktif/nonaktifkan pesan perpisahan member keluar |
| `.kick` | `.kick` | `.kick <@tag\|reply> [alasan]` | admin | Keluarkan member grup lewat tag atau reply |
| `.member` | `.member` | `.member <@tag\|reply>` | semua | Tampilkan data member grup dan ubah nilainya (admin) |
| `.randkick` | `.randkick` | `.randkick [min] [max]` | admin | Keluarkan member acak dalam rentang skor tertentu |
| `.summary` | `.summary`, `.rangkum`, `.rekap` | `.summary [jumlah pesan]` | admin/owner | Rangkum obrolan grup dengan AI |
| `.warn` | `.warn` | `.warn <@tag\|reply> [alasan]` | admin | Beri peringatan ke member grup |
| `.welcome` | `.welcome` | `.welcome [on\|off]` | admin/owner | Aktif/nonaktifkan pesan sambutan member baru |

## maker

| Command | Alias | Usage | Akses | Deskripsi |
|---|---|---|---|---|
| `.sticker` | `.sticker`, `.s`, `.stiker`, `.smeme`, `.stickermeme` | `.sticker [teks atas\|teks bawah]` | semua | Ubah gambar/video atau URL media jadi stiker dengan teks meme opsional |
| `.take` | `.take`, `.colong`, `.wm`, `.swm` | `.take <packname> [author]` | semua | Ubah metadata stiker (packname dan author) |
| `.toimg` | `.toimg`, `.tovid`, `.tovideo`, `.toimage` | `.toimg` | semua | Ubah stiker kembali jadi gambar atau video |

## owner

| Command | Alias | Usage | Akses | Deskripsi |
|---|---|---|---|---|
| `>` | `>`, `>>` | `> <kode js>` | owner | Jalankan kode JavaScript langsung dari WhatsApp (owner) |
| `$` | `$` | `$ <perintah shell>` | owner | Jalankan perintah shell langsung dari WhatsApp (owner) |
| `.call` | `.call`, `.miscall`, `.telepon`, `.telfon` | `.call <nomor\|@tag\|reply> [detik]` | owner | Telepon nomor WhatsApp selama N detik (owner) |
| `.join` | `.join`, `.masuk` | `.join <link\|kode>` | owner | Masuk grup WhatsApp lewat link undangan atau kode (owner) |
| `.leave` | `.leave`, `.out` | `.leave` | owner | Keluarkan bot dari grup saat ini (owner) |
| `.mode` | `.mode` | `.mode <public\|self>` | owner | Atur mode operasional bot (public, self) |
| `.owner` | `.owner` | `.owner <list\|set\|del> [target]` | owner | Kelola daftar owner bot (list, set, del) |
| `.persona` | `.persona` | `.persona <list\|set\|del> [mode] [target]` | owner | Kelola persona khusus dan mode girlfriend/18+ untuk user tertentu |
| `.prefix` | `.prefix` | `.prefix <list\|add\|set\|del\|reset> [prefix]` | owner | Kelola prefix command bot (list, add, set, del, reset) |
| `.say` | `.say`, `.tts`, `.ngomong` | `.say [provider] <teks>` | owner | Ucapkan teks sebagai voice note WhatsApp (owner) |
| `.shortcut` | `.shortcut` | `.shortcut <list\|add\|del> [trigger] [command]` | owner | Kelola shortcut command dinamis (trigger stiker dan emoji) |

## utility

| Command | Alias | Usage | Akses | Deskripsi |
|---|---|---|---|---|
| `.menu` | `.menu`, `.help` | `.menu [kategori\|command <nama>]` | semua | Tampilkan daftar fitur, filter kategori, atau detail satu command |
| `.note` | `.note`, `.notes` | `.note <list\|add\|del\|get> [nama]` | semua | Simpan dan baca catatan pribadi |
| `.ping` | `.ping` | `.ping` | semua | Cek respons bot dan spesifikasi server |
| `.reminder` | `.reminder`, `.remind`, `.alarm` | `.reminder <add\|list\|del\|pause> [...]` | semua | Buat, lihat, jeda, dan hapus pengingat pribadi |

