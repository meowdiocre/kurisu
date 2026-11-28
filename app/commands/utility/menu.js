import { defineCommand, formatMenuText } from '#app/services/bot/index.js';

export default defineCommand({
  name: 'menu',
  aliases: ['menu', 'help'],
  category: 'utility',
  description: 'Tampilkan daftar fitur, filter kategori, atau detail satu command',
  usage: 'menu [kategori|command <nama>]',
  examples: ['menu owner', 'menu sticker', 'menu command owner'],
  middlewares: [],

  async execute(payload, ctx) {
    const msg = ctx.msg;
    if (!msg) return;

    try {
      const prefix = msg.body?.prefix || '.';
      const userName = msg.sender?.name || 'User';
      const filter = (msg.body?.args || []).join(' ').trim();

      const text = await formatMenuText({
        prefix,
        userName,
        groupFilter: filter,
      });

      await msg.reply(text);
    } catch (err) {
      console.error('[MENU] Gagal membuat atau mengirim menu:', err);
    }
  },
});
