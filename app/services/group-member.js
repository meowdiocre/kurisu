import db from '@kurisu/core/services/database';

/**
 * Find one group member by phone number, LID, or JID identities.
 * Accepts bare digits or full JIDs and normalizes both forms.
 *
 * @param {string} groupId
 * @param {{ pn?: string | null, lid?: string | null, jids?: (string | null | undefined)[] }} identity
 * @returns {Promise<Record<string, any> | null>}
 */
export async function findGroupMember(groupId, identity = {}) {
  if (!groupId) return null;

  const candidates = new Set();
  for (const value of [identity.pn, identity.lid, ...(identity.jids || [])]) {
    if (!value) continue;
    candidates.add(value);
    if (String(value).includes('@')) {
      candidates.add(String(value).split('@')[0]);
    } else {
      candidates.add(`${value}@s.whatsapp.net`);
      candidates.add(`${value}@lid`);
    }
  }

  if (candidates.size === 0) return null;

  return db('group_members')
    .where('group_id', groupId)
    .where((builder) => {
      builder
        .whereIn('user_pn', [...candidates])
        .orWhereIn('user_lid', [...candidates]);
    })
    .first();
}

export default { findGroupMember };
