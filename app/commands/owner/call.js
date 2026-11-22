import { defineCommand } from '#app/services/bot/index.js';
import logger from '@kurisu/core/utils/logger';
import {
  DEFAULT_CALL_SECONDS,
  MAX_CALL_SECONDS,
  normalizeCallSeconds,
  placeMiscall,
  resolveCallTarget,
} from '#app/services/call.js';

const USAGE = (prefix) =>
  [
    '｢ *miscall* ｣',
    `• \`${prefix}call <nomor> [detik]\``,
    `• \`${prefix}call\` (reply/tag target) [detik]`,
    '',
    `_Durasi 1-${MAX_CALL_SECONDS} detik, default ${DEFAULT_CALL_SECONDS}._`,
  ].join('\n');

export default defineCommand({
  name: 'call',
  aliases: ['call', 'miscall', 'telepon', 'telfon'],
  category: 'owner',
  description: 'Ring a WhatsApp number for N seconds (owner only)',
  middlewares: ['sender:isOwner'],

  async execute(payload, ctx) {
    const { client, msg } = ctx;
    if (!msg) return;

    const prefix = msg.body?.prefix || '.';
    const args = (msg.body?.args || []).map(String);
    const hasContext = Boolean(
      msg.quoted || msg.body?.mentionedJid?.length
    );

    let seconds = DEFAULT_CALL_SECONDS;
    const last = args[args.length - 1];
    const lastIsShortNumber = /^\d{1,2}$/.test(last || '');
    const lastIsSeconds = lastIsShortNumber && (args.length > 1 || hasContext);

    if (lastIsSeconds) {
      const parsed = normalizeCallSeconds(args.pop(), null);
      if (parsed === null) {
        return msg.reply(`Durasi harus 1-${MAX_CALL_SECONDS} detik.`);
      }
      seconds = parsed;
    }

    const target = resolveCallTarget(msg, args.join(' ').trim());
    if (!target) {
      return msg.reply(USAGE(prefix));
    }

    await msg.reply(
      `Miscall ke *${target.split('@')[0]}* selama *${seconds} detik*...`
    );

    try {
      await placeMiscall(client, target, seconds);
      logger.info('[OWNER]', `Miscall sent to ${target} for ${seconds}s`);
    } catch (err) {
      logger.error('[OWNER]', `Miscall failed for ${target}: ${err.message}`);
      await msg.reply(`Miscall gagal: ${err.message}`);
    }
  },
});
