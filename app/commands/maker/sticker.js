import { defineCommand } from '#app/services/bot/index.js';
import { createSticker } from '#app/services/sticker.js';
import logger from '@kurisu/core/utils/logger';

export default defineCommand({
  name: 'sticker',
  aliases: ['s', 'sticker', 'stiker', 'smeme', 'stickermeme'],
  category: 'maker',
  description: 'Ubah gambar/video atau URL media jadi stiker dengan teks meme opsional',
  usage: 'sticker [teks atas|teks bawah]',
  examples: ['sticker', 'sticker halo|dunia', 'sticker https://...'],

  async execute(payload, ctx) {
    const { client, msg } = ctx;
    if (!msg) return;

    try {
      const sticker = await createSticker({
        msg,
        text: msg.body?.argsText?.trim() || '',
      });

      if (!sticker) {
        return await msg.reply(
          'Reply atau kirim gambar/video, atau berikan URL media yang valid.'
        );
      }

      await client.message.send(
        msg.chat,
        {
          type: 'sticker',
          media: sticker,
        },
        { quote: payload }
      );
    } catch (err) {
      logger.error('[STICKER]', `Failed to process sticker: ${err.message}`);
      await msg.reply('Gagal membuat stiker. Pastikan medianya valid.');
    }
  },
});
