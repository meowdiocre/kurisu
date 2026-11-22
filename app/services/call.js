import { delay } from '@kurisu/core/utils/common';
import logger from '@kurisu/core/utils/logger';
import { isLidJid } from 'zapo-js';

export const MAX_CALL_SECONDS = 120;
export const DEFAULT_CALL_SECONDS = 5;

const cleanDigits = (value) => String(value || '').replace(/[^0-9]/g, '');

const toBareUser = (jid) => {
  if (!jid) return null;
  const [user] = String(jid).split('@');
  return user.split(':')[0] || null;
};

/**
 * Parse a miscall duration.
 *
 * @param {unknown} value
 * @param {number} [fallback]
 * @returns {number | null} seconds, or null when out of range
 */
export function normalizeCallSeconds(value, fallback = DEFAULT_CALL_SECONDS) {
  if (value === undefined || value === null || value === '') return fallback;
  const seconds = Number.parseInt(String(value), 10);
  if (!Number.isFinite(seconds)) return null;
  if (seconds < 1 || seconds > MAX_CALL_SECONDS) return null;
  return seconds;
}

/**
 * Resolve a call target from explicit input, a mention, or a quoted sender.
 * A bare number that matches a mention keeps the mention's addressing
 * (LID vs PN) so a LID is never mistaken for a phone number.
 *
 * @param {any} msg - Parsed message
 * @param {string} [input] - Manual number or JID
 * @returns {string | null} WhatsApp user JID
 */
export function resolveCallTarget(msg, input = '') {
  /** @type {{ jid: string, bare: string }[]} */
  const candidates = [];
  const add = (jid, kind) => {
    const bare = toBareUser(jid);
    if (!bare || bare.length < 7) return;
    candidates.push({ jid: `${bare}@${kind}`, bare });
  };

  const manual = String(input || '').trim();
  const isMentionToken = manual.startsWith('@');
  const manualDigits = !isMentionToken ? cleanDigits(manual) : '';

  if (manual && !isMentionToken) {
    if (isLidJid(manual)) {
      add(manual, 'lid');
    } else if (manualDigits.length >= 7 && manualDigits.length <= 16) {
      add(`${manualDigits}@s.whatsapp.net`, 's.whatsapp.net');
    }
  }

  for (const mention of msg?.body?.mentionedJid || []) {
    add(mention, isLidJid(mention) ? 'lid' : 's.whatsapp.net');
  }

  const quoted = msg?.quoted?.sender;
  if (quoted) {
    if (quoted.pn) add(quoted.pn, 's.whatsapp.net');
    if (quoted.lid) add(quoted.lid, 'lid');
    if (quoted.id) {
      add(quoted.id, isLidJid(quoted.id) ? 'lid' : 's.whatsapp.net');
    }
  }

  if (manualDigits) {
    const addressed = candidates.find(
      (item) =>
        item.bare === manualDigits && !item.jid.endsWith('@s.whatsapp.net')
    );
    if (addressed) return addressed.jid;
  }

  return candidates[0]?.jid || null;
}

/**
 * Resolve a call target and prefer a phone-number JID for calls.
 * LID mentions are mapped through the contact store when a PN is known.
 *
 * @param {any} client
 * @param {any} msg
 * @param {string} [input]
 * @returns {Promise<string | null>}
 */
export async function resolveCallTargets(client, msg, input = '') {
  const primary = resolveCallTarget(msg, input);
  /** @type {string[]} */
  const targets = [];
  const push = (jid) => {
    if (jid && !targets.includes(jid)) targets.push(jid);
  };

  const pnFromContact = (contact) => {
    const pn =
      contact?.phoneNumber ||
      (contact?.jid && !isLidJid(contact.jid) ? contact.jid : null);
    const bare = toBareUser(pn);
    return bare && bare.length >= 7 ? `${bare}@s.whatsapp.net` : null;
  };

  if (!primary) return targets;

  if (primary.endsWith('@lid')) {
    push(primary);
    try {
      const contact = await client?.stores?.contacts?.getByJid?.(primary);
      const pn = pnFromContact(contact);
      if (pn) push(pn);
    } catch {
      // Keep the LID candidate when the contact store cannot answer.
    }
    return targets;
  }

  const manual = String(input || '').trim();
  const manualDigits =
    manual && !manual.startsWith('@') && !manual.includes('@')
      ? cleanDigits(manual)
      : '';

  // A bare number may be a LID typed without the @lid suffix.
  if (manualDigits) {
    const lidJid = `${manualDigits}@lid`;
    try {
      const contact = await client?.stores?.contacts?.getByJid?.(lidJid);
      if (contact) {
        push(lidJid);
        const pn = pnFromContact(contact);
        if (pn) push(pn);
      }
    } catch {
      // Fall through to the PN candidate.
    }
  }

  push(primary);
  return targets;
}

/**
 * Turn provider errors into a short user-facing reason.
 *
 * @param {unknown} err
 * @returns {string}
 */
export function describeCallError(err) {
  const message = String(err?.message ?? err ?? '').trim();
  if (/no device sessions/i.test(message)) {
    return 'Nomor itu tidak aktif di WhatsApp / tidak ada device yang bisa dihubungi.';
  }
  if (/concurrent|max.*call|limit/i.test(message)) {
    return 'Masih ada panggilan aktif. Tunggu call sebelumnya selesai.';
  }
  return message || 'Panggilan gagal.';
}

/**
 * Ring a WhatsApp user for a fixed number of seconds, then hang up.
 * Tries each candidate JID (LID first, then PN) until one has devices.
 *
 * @param {any} client
 * @param {string | string[]} peerJids
 * @param {number} seconds
 * @returns {Promise<{ callId: string, peerJid: string }>}
 */
export async function placeMiscall(client, peerJids, seconds) {
  if (!client?.voip?.startCall || !client?.voip?.endCall) {
    throw new Error('VoIP plugin is not available');
  }

  const targets = (Array.isArray(peerJids) ? peerJids : [peerJids]).filter(
    Boolean
  );
  if (targets.length === 0) {
    throw new Error('No call target');
  }

  let lastError = null;
  for (const peerJid of targets) {
    try {
      const callId = await client.voip.startCall({
        peerJid,
        isVideo: false,
      });

      logger.info('[CALL]', `Miscall ${peerJid} for ${seconds}s (${callId})`);

      try {
        await delay(seconds * 1000);
      } finally {
        try {
          await client.voip.endCall(callId);
        } catch (err) {
          logger.warn(
            '[CALL]',
            `Failed to end call ${callId}: ${err.message ?? err}`
          );
        }
      }

      return { callId, peerJid };
    } catch (err) {
      lastError = err;
      if (!/no device sessions/i.test(String(err?.message ?? ''))) {
        throw err;
      }
      logger.warn(
        '[CALL]',
        `No devices for ${peerJid}; trying next candidate`
      );
    }
  }

  throw lastError;
}

export default {
  MAX_CALL_SECONDS,
  DEFAULT_CALL_SECONDS,
  normalizeCallSeconds,
  resolveCallTarget,
  resolveCallTargets,
  describeCallError,
  placeMiscall,
};
