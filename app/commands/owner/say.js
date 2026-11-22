import { defineCommand } from '#app/services/bot/index.js';
import logger from '@kurisu/core/utils/logger';
import { synthesizeVoice } from '#app/services/tts.js';

export default defineCommand({
  name: 'say',
  aliases: ['say', 'tts', 'ngomong'],
  category: 'owner',
  description: 'Speak text as a WhatsApp voice note (owner only)',
  middlewares: ['sender:isOwner'],

  async execute(payload, ctx) {
    const { client, msg } = ctx;
    if (!msg) return;

    const text = (msg.body?.argsText || '').trim();
    if (!text) {
      return msg.reply(
        `Gunakan: \`${msg.body?.prefix || '.'}say <teks>\``
      );
    }

    if (!client?.message?.send) {
      return msg.reply('Voice sender is not available.');
    }

    const voice = await synthesizeVoice(text);
    if (!voice) {
      return msg.reply('Gagal membuat voice note (TTS error).');
    }

    try {
      await client.message.send(
        msg.chat,
        {
          type: 'audio',
          media: voice.buffer,
          mimetype: voice.mimetype,
          ptt: true,
          seconds: voice.seconds,
        },
        { quote: payload }
      );
      logger.info('[TTS]', `Voice note sent to ${msg.chat} (${voice.seconds}s)`);
    } catch (err) {
      logger.error('[TTS]', `Failed to send voice note: ${err.message}`);
      await msg.reply(`Gagal mengirim voice note: ${err.message}`);
    }
  },
});
