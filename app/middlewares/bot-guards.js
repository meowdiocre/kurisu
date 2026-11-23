/**
 * Standard command middleware guards for Kurisu bot.
 */

import {
  findGroupParticipant,
  getGroupMetadata,
} from '#app/services/bot/message.js';

/**
 * Parameterized sender permission guard.
 *
 * Example usage in command definitions:
 * - `middlewares: ['sender:isOwner']`
 * - `middlewares: ['sender:admin,superAdmin']`
 * - `middlewares: ['sender:admin,superAdmin,isOwner']`
 *
 * @type {import('#app/services/bot/types.js').CommandMiddlewareHandler}
 */
export async function senderGuard(payload, ctx, args = []) {
  const senderPerms = ctx.msg?.permissions?.sender;
  if (!senderPerms) return false;

  const requiredRoles = args.length > 0 ? args : ['admin'];

  const hasAccess = requiredRoles.some((role) => {
    switch (role.toLowerCase()) {
      case 'isowner':
      case 'owner':
        return Boolean(senderPerms.isOwner);
      case 'admin':
        return Boolean(senderPerms.admin || senderPerms.superAdmin);
      case 'superadmin':
        return Boolean(senderPerms.superAdmin);
      default:
        return Boolean(/** @type {Record<string, any>} */ (senderPerms)[role]);
    }
  });

  if (!hasAccess) {
    const isOnlyOwner =
      requiredRoles.length === 1 &&
      (requiredRoles[0].toLowerCase() === 'isowner' ||
        requiredRoles[0].toLowerCase() === 'owner');

    const rejection = isOnlyOwner ? 'Khusus owner!' : 'Khusus admin!';
    if (typeof ctx.msg?.reply === 'function') {
      try {
        await ctx.msg.reply(rejection);
      } catch {}
    }
    return false;
  }

  return true;
}

/**
 * Parameterized bot permission guard.
 *
 * Example usage in command definitions:
 * - `middlewares: ['bot:admin']`
 *
 * @type {import('#app/services/bot/types.js').CommandMiddlewareHandler}
 */
export async function botGuard(payload, ctx, args = []) {
  const requiredRoles = args.length > 0 ? args : ['admin'];

  const hasRole = (botPerms) =>
    requiredRoles.some((role) => {
      switch (role.toLowerCase()) {
        case 'admin':
          return Boolean(botPerms?.admin || botPerms?.superAdmin);
        case 'superadmin':
          return Boolean(botPerms?.superAdmin);
        default:
          return Boolean(botPerms?.[role]);
      }
    });

  let botPerms = ctx.msg?.permissions?.bot;
  let hasAccess = hasRole(botPerms);

  // Group metadata is cached for 5 minutes. If the bot was just promoted,
  // refresh once before rejecting a bot-admin command.
  if (!hasAccess && ctx.msg?.flags?.isGroup && ctx.client && ctx.msg?.chat) {
    try {
      const metadata = await getGroupMetadata(ctx.client, ctx.msg.chat, true);
      const participant = findGroupParticipant(metadata?.participants, {
        id: ctx.msg.bot?.id,
        pn: ctx.msg.bot?.pn,
        lid: ctx.msg.bot?.lid,
      });

      if (participant) {
        botPerms = {
          isOwner: Boolean(botPerms?.isOwner),
          admin: Boolean(participant.isAdmin || participant.isSuperAdmin),
          superAdmin: Boolean(participant.isSuperAdmin),
        };
        ctx.msg.permissions = {
          ...(ctx.msg.permissions || {}),
          bot: botPerms,
        };
        hasAccess = hasRole(botPerms);
      }
    } catch {}
  }

  if (!hasAccess) {
    if (typeof ctx.msg?.reply === 'function') {
      try {
        await ctx.msg.reply('Bot bukan admin!');
      } catch {}
    }
    return false;
  }

  return true;
}

/**
 * Group-only guard middleware.
 * Rejects commands executed outside group chats.
 *
 * Example usage in command definitions:
 * - `middlewares: ['group']`
 *
 * @type {import('#app/services/bot/types.js').CommandMiddlewareHandler}
 */
export async function groupOnlyGuard(payload, ctx) {
  if (!ctx.msg?.flags?.isGroup) {
    if (typeof ctx.msg?.reply === 'function') {
      try {
        await ctx.msg.reply('Hanya bisa di grup!');
      } catch {}
    }
    return false;
  }

  return true;
}

/**
 * Private-chat-only guard middleware.
 * Rejects commands executed inside group chats.
 *
 * Example usage in command definitions:
 * - `middlewares: ['private']`
 *
 * @type {import('#app/services/bot/types.js').CommandMiddlewareHandler}
 */
export async function privateOnlyGuard(payload, ctx) {
  if (ctx.msg?.flags?.isGroup) {
    if (typeof ctx.msg?.reply === 'function') {
      try {
        await ctx.msg.reply('Hanya bisa di chat pribadi!');
      } catch {}
    }
    return false;
  }

  return true;
}

export default {
  sender: senderGuard,
  bot: botGuard,
  group: groupOnlyGuard,
  private: privateOnlyGuard,
};
