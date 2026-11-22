/**
 * Sender permission helpers shared by commands, skills, and middlewares.
 *
 * @param {any} msg
 * @returns {boolean}
 */
export function isOwner(msg) {
  return Boolean(msg?.permissions?.sender?.isOwner);
}

/**
 * Group admin, super admin, or bot owner.
 *
 * @param {any} msg
 * @returns {boolean}
 */
export function isGroupAdmin(msg) {
  return Boolean(
    msg?.permissions?.sender?.admin ||
      msg?.permissions?.sender?.superAdmin ||
      msg?.permissions?.sender?.isOwner
  );
}
