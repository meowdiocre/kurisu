import { isGroupAdmin } from '#app/utils/roles.js';

/**
 * Group bot access mode guard middleware.
 * Enforces group botAccess policy ('everyone' vs 'admin').
 *
 * @type {import('@kurisu/core/services/modules').EventMiddleware<'message'>}
 */
export default async function groupModeMiddleware(payload, ctx) {
  const msg = ctx.msg;
  const group = ctx.tableGroup;

  if (!msg?.flags?.isGroup || !group?.settings) return;

  const botAccess = group.settings.botAccess || 'everyone';
  if (botAccess === 'admin') {
    if (!isGroupAdmin(msg)) {
      return ctx.stop();
    }
  }
}

