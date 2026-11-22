import { defineSkill } from '#app/services/ai/skill.js';
import { extractMentionsFromText } from '#app/services/bot/index.js';
import { findGroupMember } from '#app/services/group-member.js';
import { normalizeIdentity } from '#app/utils/target.js';
import { isGroupAdmin } from '#app/utils/roles.js';
import { formatRelativeTime } from '#app/utils/time.js';

export default defineSkill({
  name: 'get_member_info',
  description:
    'Read a group member record: warnings, score, last warned, and last activity. Use when the user asks about their own record or, for admins, another replied/mentioned member.',
  parameters: {
    type: 'object',
    properties: {
      target: {
        type: 'string',
        enum: ['self', 'replied', 'mentioned'],
        description:
          'Whose record to read. Defaults to self. Use replied for the quoted message sender, mentioned for the first tagged member.',
      },
    },
  },
  async execute(args, context) {
    const { msg, ctx } = context || {};
    if (!msg?.flags?.isGroup) {
      return 'Ini bukan chat grup.';
    }

    const tableGroup = ctx?.tableGroup;
    const groupId = tableGroup?.id || msg.chat;
    const senderIsAdmin = isGroupAdmin(msg);
    const mode = args?.target || 'self';

    if (mode !== 'self' && !senderIsAdmin) {
      return 'Hanya admin grup yang bisa membaca data member lain.';
    }

    let member = null;
    let targetLabel = 'kamu';

    if (mode === 'self') {
      member = ctx?.tableGroupMember || null;
      if (!member) {
        member = await findGroupMember(groupId, {
          pn: msg.sender?.pn,
          lid: msg.sender?.lid,
          jids: [msg.sender?.id].filter(Boolean),
        });
      }
    } else {
      let target = null;

      if (mode === 'replied') {
        const quotedSender = msg.quoted?.sender;
        if (!quotedSender) {
          return 'Tidak ada pesan yang di-reply.';
        }
        target = {
          pn: quotedSender.pn || null,
          lid: quotedSender.lid || null,
          jids: [quotedSender.id, quotedSender.pn, quotedSender.lid].filter(
            Boolean
          ),
        };
      } else {
        const mention =
          msg.body?.mentionedJid?.[0] ||
          extractMentionsFromText(msg.body?.rawText || '')[0];
        if (!mention) {
          return 'Tidak ada member yang di-tag.';
        }
        const identity = normalizeIdentity(mention);
        target = {
          pn: identity && !identity.isLid ? identity.id : null,
          lid: identity?.isLid ? identity.id : null,
          jids: [mention],
        };
      }

      member = await findGroupMember(groupId, target);
      targetLabel =
        member?.pushname ||
        target.pn?.split('@')[0] ||
        target.lid?.split('@')[0] ||
        'member itu';
    }

    if (!member) {
      return `Tidak ada data tersimpan untuk ${targetLabel}.`;
    }

    const maxWarn = Number(tableGroup?.settings?.maxWarn ?? 3);
    const name = member.pushname || targetLabel;
    return [
      `Nama: ${name}`,
      `Peringatan: ${Number(member.warnings || 0)}/${maxWarn}`,
      `Skor: ${Number(member.score || 0)}`,
      `Terakhir diperingatkan: ${formatRelativeTime(member.last_warned_at, 'belum pernah')}`,
      `Terakhir aktif: ${formatRelativeTime(member.last_interacted_at, 'belum pernah')}`,
    ].join('\n');
  },
});
