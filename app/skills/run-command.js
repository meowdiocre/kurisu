import { defineSkill } from '#app/services/ai/skill.js';
import logger from '@kurisu/core/utils/logger';
import {
  dispatchCommand,
  getAllCommands,
  getCommand,
} from '#app/services/bot/index.js';

/**
 * Command yang aman dijalankan lewat AI.
 * Guard/middleware command tetap berlaku; command berbahaya tetap manual.
 */
const ALLOWED_COMMANDS = new Set([
  'kick',
  'warn',
  'gmode',
  'blockword',
  'botaccess',
  'welcome',
  'goodbye',
  'board',
  'member',
  'summary',
  'note',
  'gnote',
  'reminder',
  'sticker',
  'take',
  'toimg',
  'download',
  'menu',
  'ping',
]);

const DENIED_TRIGGERS = new Set([
  'exec',
  '$',
  'eval',
  '>',
  '>>',
  'owner',
  'prefix',
  'shortcut',
  'persona',
  'mode',
  'join',
  'masuk',
  'leave',
  'out',
  'call',
  'miscall',
  'telepon',
  'telfon',
  'say',
  'tts',
  'ngomong',
  'randkick',
  'test',
]);

export default defineSkill({
  name: 'run_bot_command',
  description:
    'Jalankan command Kurisu yang aman dengan guard yang sama seperti command manual. Gunakan untuk aksi grup (kick, warn, gmode, blockword, botaccess, welcome, goodbye, board, member, summary), catatan, reminder, stiker, download, menu, dan ping. Contoh: {"command":"kick","args":"628123456789 spam"}, {"command":"blockword","args":"add link:all"}, {"command":"botaccess","args":"admin"}. Jangan gunakan untuk eval, exec, owner, prefix, shortcut, persona, mode, join, leave, call, atau say.',
  parameters: {
    type: 'object',
    properties: {
      command: {
        type: 'string',
        description:
          'Nama command tanpa prefix. Boleh sekalian argumen, misalnya "kick @user spam" atau "blockword add link:all".',
      },
      args: {
        type: 'string',
        description:
          'Argumen command tanpa nama command. Contoh: "@user alasan", "add link:all", "admin", "now", "https://...", "halo|dunia".',
      },
    },
    required: ['command'],
  },

  async execute(args, context) {
    const { payload, msg, ctx } = context || {};
    if (!msg || !ctx) {
      return 'Command runner tidak tersedia di chat ini.';
    }

    const [rawTrigger, ...embeddedArgs] = String(args?.command || '')
      .trim()
      .split(/\s+/);
    const trigger = String(rawTrigger || '')
      .replace(/^[.\/!#]+/, '')
      .toLowerCase();
    if (!trigger) {
      return 'Nama command kosong.';
    }

    if (DENIED_TRIGGERS.has(trigger)) {
      return `Command "${trigger}" tidak diizinkan lewat AI. Gunakan command manual.`;
    }

    const command =
      (await getCommand(trigger)) ||
      (await getAllCommands()).find(
        (entry) => entry.name.toLowerCase() === trigger
      );
    if (!command) {
      return `Command "${trigger}" tidak ditemukan.`;
    }

    if (!ALLOWED_COMMANDS.has(command.name)) {
      return `Command "${command.name}" tidak diizinkan lewat AI. Gunakan command manual.`;
    }

    const explicitArgs = String(
      Array.isArray(args?.args) ? args.args.join(' ') : args?.args || ''
    ).trim();
    const argsText = [embeddedArgs.join(' '), explicitArgs]
      .filter(Boolean)
      .join(' ')
      .trim();
    const prefix =
      msg.body?.prefix ||
      ctx.tableBot?.prefixes?.[0] ||
      '.';

    // Pertahankan helper non-enumerable (reply/send/download) lewat prototype.
    const syntheticMsg = Object.create(msg);
    syntheticMsg.body = {
      ...msg.body,
      prefix,
      command: `${prefix}${trigger}`,
      commandWithoutPrefix: trigger,
      argsText,
      args: argsText ? argsText.split(/\s+/) : [],
    };

    const syntheticCtx = Object.create(ctx);
    syntheticCtx.msg = syntheticMsg;

    try {
      const ok = await dispatchCommand(payload, syntheticCtx);
      ctx.suppressAiReply = true;
      return ok
        ? `Command "${command.name}" dijalankan. Jangan kirim balasan tambahan.`
        : `Command "${command.name}" ditolak atau gagal. Jangan kirim balasan tambahan.`;
    } catch (err) {
      logger.error(
        '[AI_SKILL]',
        `run_bot_command failed for ${command.name}: ${err.message}`
      );
      ctx.suppressAiReply = true;
      return `Command "${command.name}" gagal dijalankan.`;
    }
  },
});
