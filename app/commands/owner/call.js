import { defineCommand } from '#app/services/bot/index.js';
import logger from '@kurisu/core/utils/logger';
import {
  DEFAULT_CALL_SECONDS,
  MAX_CALL_SECONDS,
  describeCallError,
  normalizeCallSeconds,
  placeMiscall,
  resolveCallTargets,
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
  description: 'Telepon nomor WhatsApp selama N detik (owner)',
  usage: 'call <nomor|@tag|reply> [detik]',
  examples: ['call 628123456789 5', 'call @user 10', 'call aku 30'],
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

    const targets = await resolveCallTargets(
      client,
      msg,
      args.join(' ').trim()
    );
    if (targets.length === 0) {
      return msg.reply(USAGE(prefix));
    }

    const display = (
      targets.find((jid) => jid.endsWith('@s.whatsapp.net')) || targets[0]
    ).split('@')[0];

    await msg.reply(
      `Miscall ke *${display}* selama *${seconds} detik*...`
    );

    try {
      const { peerJid } = await placeMiscall(client, targets, seconds);
      logger.info('[OWNER]', `Miscall sent to ${peerJid} for ${seconds}s`);
    } catch (err) {
      const reason = describeCallError(err);
      logger.error(
        '[OWNER]',
        `Miscall failed for ${targets.join(', ')}: ${err.message}`
      );
      await msg.reply(`Miscall gagal: ${reason}`);
    }
  },
});
