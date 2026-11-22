import { defineCommand } from '#app/services/bot/index.js';
import logger from '@kurisu/core/utils/logger';
import { TTS_PROVIDERS, synthesizeVoice } from '#app/services/tts.js';

const SAMPLE_TEXT =
  'Halo, aku Kurisu. Ini contoh suara yang lebih natural buat ngobrol di WhatsApp.';

const sendVoice = async (client, msg, payload, voice) => {
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
};

export default defineCommand({
  name: 'say',
  aliases: ['say', 'tts', 'ngomong'],
  category: 'owner',
  description: 'Speak text as a WhatsApp voice note (owner only)',
  middlewares: ['sender:isOwner'],

  async execute(payload, ctx) {
    const { client, msg } = ctx;
    if (!msg) return;

    if (!client?.message?.send) {
      return msg.reply('Voice sender is not available.');
    }

    const prefix = msg.body?.prefix || '.';
    let text = (msg.body?.argsText || '').trim();
    if (!text) {
      return msg.reply(
        `Gunakan: \`${prefix}say [${TTS_PROVIDERS.join('|')}] <teks>\` atau \`${prefix}say test\``
      );
    }

    const first = text.split(/\s+/)[0].toLowerCase();
    let provider = null;
    if (TTS_PROVIDERS.includes(first)) {
      provider = first;
      text = text.slice(first.length).trim();
    }

    if (text.toLowerCase() === 'test') {
      const providers = ['edge', 'google'];
      if (process.env.ELEVENLABS_API_KEY) providers.push('elevenlabs');

      for (const name of providers) {
        await msg.reply(`Sample *${name}*:`);
        const voice = await synthesizeVoice(SAMPLE_TEXT, { provider: name });
        if (!voice) {
          await msg.reply(`_${name} gagal synthesize._`);
          continue;
        }
        try {
          await sendVoice(client, msg, payload, voice);
        } catch (err) {
          logger.error('[TTS]', `Sample ${name} send failed: ${err.message}`);
          await msg.reply(`_${name} gagal dikirim._`);
        }
      }
      return;
    }

    if (!text) {
      return msg.reply(`Teks kosong. Contoh: \`${prefix}say google halo\``);
    }

    const voice = await synthesizeVoice(text, { provider: provider || undefined });
    if (!voice) {
      return msg.reply(
        `Gagal membuat voice note${provider ? ` dengan ${provider}` : ''} (TTS error).`
      );
    }

    try {
      await sendVoice(client, msg, payload, voice);
      logger.info(
        '[TTS]',
        `Voice note sent to ${msg.chat} via ${voice.provider} (${voice.seconds}s)`
      );
    } catch (err) {
      logger.error('[TTS]', `Failed to send voice note: ${err.message}`);
      await msg.reply(`Gagal mengirim voice note: ${err.message}`);
    }
  },
});
