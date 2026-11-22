import { defineCommand } from '#app/services/bot/index.js';
import { writeExif } from '@kurisu/core/utils/metadata';
import logger from '@kurisu/core/utils/logger';

export default defineCommand({
  name: 'take',
  aliases: ['take', 'colong', 'wm', 'swm'],
  category: 'maker',
  description: 'Ubah metadata stiker (packname dan author)',
  usage: 'take <packname> [author]',
  examples: ['take Kurisu', 'take Kurisu BOT'],

  async execute(payload, ctx) {
    const { client, msg } = ctx;
    if (!msg) return;

    try {
      // 1. Validate that the quoted message is a sticker
      if (!msg.quoted || !msg.quoted.flags.isSticker) {
        return await msg.reply('Reply stikernya dulu!');
      }

      // 2. Parse packname & author from arguments
      const argsText = msg.body?.argsText?.trim() || '';
      let packname = 'Kurisu';
      let author = 'BOT';

      if (argsText) {
        const parts = argsText.split('|');
        packname = parts[0]?.trim() || 'Kurisu';
        author = parts.length > 1 ? parts.slice(1).join('|').trim() : 'BOT';
      }

      // 3. Download the quoted sticker buffer
      const dl = await msg.quoted.download();
      if (!dl || !Buffer.isBuffer(dl)) {
        return await msg.reply('Gagal mengunduh stiker.');
      }
      const stickerBuffer = dl;

      // 4. Rewrite EXIF metadata
      const modifiedSticker = await writeExif(stickerBuffer, {
        packname,
        author,
      });

      // 5. Send modified sticker back
      await client.message.send(
        msg.chat,
        {
          type: 'sticker',
          media: modifiedSticker,
        },
        { quote: payload }
      );
    } catch (err) {
      logger.error('[TAKE]', `Failed to modify sticker EXIF: ${err.message}`);
      await msg.reply('Gagal memperbarui metadata stiker.');
    }
  },
});

