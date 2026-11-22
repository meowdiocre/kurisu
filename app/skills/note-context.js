/**
 * Resolve the session id for a note skill call.
 *
 * @param {any} ctx
 * @returns {string | null}
 */
export function getNoteSkillSession(ctx) {
  return ctx?.sessionId || process.env.SESSION_ID || null;
}

/**
 * Validate a scope for read, list, or delete operations.
 *
 * @param {string} scope
 * @param {any} msg
 * @returns {{ scope: 'personal' | 'group', error?: never } | { scope?: never, error: string }}
 */
export function validateNoteReadScope(scope, msg) {
  const normalized = String(scope || '').toLowerCase();

  if (normalized !== 'personal' && normalized !== 'group') {
    return { error: 'Scope harus "personal" atau "group".' };
  }

  if (normalized === 'personal' && msg?.flags?.isGroup) {
    return { error: 'Catatan personal hanya tersedia di chat pribadi.' };
  }

  if (normalized === 'group' && !msg?.flags?.isGroup) {
    return { error: 'Catatan grup hanya tersedia di grupnya.' };
  }

  return { scope: normalized };
}

/**
 * Extract plain text from a replied message.
 *
 * @param {any} msg
 * @returns {string}
 */
export function quotedNoteText(msg) {
  return String(msg?.quoted?.body?.rawText || '').trim();
}
