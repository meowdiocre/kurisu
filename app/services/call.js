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
 * Explicit input wins so `.call 628...` is never overridden by a reply.
 *
 * @param {any} msg - Parsed message
 * @param {string} [input] - Manual number or JID
 * @returns {string | null} WhatsApp user JID
 */
export function resolveCallTarget(msg, input = '') {
  const candidates = [];
  const add = (jid, kind) => {
    const bare = toBareUser(jid);
    if (!bare || bare.length < 7) return;
    candidates.push(`${bare}@${kind}`);
  };

  const manual = String(input || '').trim();
  const isMentionToken = manual.startsWith('@');
  if (manual && !isMentionToken) {
    if (isLidJid(manual)) {
      add(manual, 'lid');
    } else {
      const digits = cleanDigits(manual);
      if (digits.length >= 7 && digits.length <= 16) {
        add(`${digits}@s.whatsapp.net`, 's.whatsapp.net');
      }
    }
  }

  const mention = msg?.body?.mentionedJid?.[0];
  if (mention) {
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

  return candidates[0] || null;
}

/**
 * Ring a WhatsApp user for a fixed number of seconds, then hang up.
 *
 * @param {any} client
 * @param {string} peerJid
 * @param {number} seconds
 * @returns {Promise<string>} call id
 */
export async function placeMiscall(client, peerJid, seconds) {
  if (!client?.voip?.startCall || !client?.voip?.endCall) {
    throw new Error('VoIP plugin is not available');
  }

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

  return callId;
}

export default {
  MAX_CALL_SECONDS,
  DEFAULT_CALL_SECONDS,
  normalizeCallSeconds,
  resolveCallTarget,
  placeMiscall,
};
