import { defineCommand } from '#app/services/bot/index.js';
import logger from '@kurisu/core/utils/logger';

const INVITE_REGEX =
  /(?:https?:\/\/)?(?:chat\.whatsapp\.com\/)?([0-9A-Za-z]{20,24})/i;

export default defineCommand({
  name: 'join',
  aliases: ['join', 'masuk'],
  category: 'owner',
  description: 'Masuk grup WhatsApp lewat link undangan atau kode (owner)',
  usage: 'join <link|kode>',
  examples: ['join https://chat.whatsapp.com/...'],
  middlewares: ['sender:isOwner'],

  async execute(payload, ctx) {
    const { client, msg } = ctx;
    if (!msg) return;

    try {
      const text = (msg.body?.argsText || '').trim();
      const match = text.match(INVITE_REGEX);

      if (!match) {
        return await msg.reply(
          'Provide a valid WhatsApp group invite link or code!'
        );
      }

      const inviteCode = match[1];

      if (!client?.group?.joinGroupViaInvite) {
        return await msg.reply('Fitur grup tidak tersedia.');
      }

      // Check invite info first to get group metadata & membership approval mode
      let inviteInfo = null;
      if (typeof client.group.queryGroupInviteInfo === 'function') {
        try {
          inviteInfo = await client.group.queryGroupInviteInfo(inviteCode);
        } catch (infoErr) {
          logger.debug('[OWNER]', `Failed to query invite info: ${infoErr.message}`);
        }
      }

      try {
        const result = await client.group.joinGroupViaInvite(inviteCode);
        const groupSubject = result?.subject || inviteInfo?.subject || 'the group';

        logger.info(
          '[OWNER]',
          `Bot successfully joined group ${result?.jid || inviteCode} via invite link.`
        );

        return await msg.reply(`Berhasil masuk *${groupSubject}*!`);
      } catch (joinErr) {
        // If join failed because group requires admin approval or response was empty <iq>
        if (joinErr.message?.includes('expected <group> node in response')) {
          const groupSubject = inviteInfo?.subject || 'the group';
          logger.info(
            '[OWNER]',
            `Join request sent for group ${inviteInfo?.jid || inviteCode} (membership approval required).`
          );
          return await msg.reply(
            `Join request submitted for *${groupSubject}*. Waiting for admin approval.`
          );
        }
        throw joinErr;
      }
    } catch (err) {
      logger.error(
        '[OWNER]',
        `Failed to join group via invite: ${err.message}`
      );
      await msg.reply(`Gagal masuk grup: ${err.message}`);
    }
  },
});
