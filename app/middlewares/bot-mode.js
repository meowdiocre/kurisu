import { isOwner } from '#app/utils/roles.js';

/**
 * Bot operating mode guard middleware.
 * If bot is set to self mode, only messages from owners are processed.
 *
 * @type {import('@kurisu/core/services/modules').EventMiddleware<'message'>}
 */
export default async function botModeMiddleware(payload, ctx) {
  const isSelfMode = Boolean(ctx.tableBot?.self);

  if (isSelfMode && !isOwner(ctx.msg)) {
    return ctx.stop();
  }
}

