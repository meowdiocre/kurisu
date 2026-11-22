import { defineSkill } from '#app/services/ai/skill.js';
import { isOwner } from '#app/utils/roles.js';
import logger from '@kurisu/core/utils/logger';
import {
  DEFAULT_CALL_SECONDS,
  MAX_CALL_SECONDS,
  describeCallError,
  normalizeCallSeconds,
  placeMiscall,
  resolveCallTargets,
} from '#app/services/call.js';

export default defineSkill({
  name: 'call_number',
  description:
    'Ring another WhatsApp number (miscall) for a few seconds, then hang up. Owner only. Use only when the owner explicitly asks to call or miscall someone.',
  parameters: {
    type: 'object',
    properties: {
      target: {
        type: 'string',
        description:
          'Phone number with country code, a LID JID, or empty when replying to the target message.',
      },
      seconds: {
        type: 'integer',
        minimum: 1,
        maximum: MAX_CALL_SECONDS,
        description: `Ring duration in seconds, 1-${MAX_CALL_SECONDS}. Default ${DEFAULT_CALL_SECONDS}.`,
      },
    },
  },

  async execute(args, context) {
    const { client, msg } = context || {};
    if (!msg || !client?.voip?.startCall) {
      return 'Skill panggilan tidak tersedia di chat ini.';
    }

    if (!isOwner(msg)) {
      return 'Khusus owner: miscall hanya untuk owner bot.';
    }

    const targets = await resolveCallTargets(
      client,
      msg,
      typeof args?.target === 'string' ? args.target : ''
    );
    if (targets.length === 0) {
      return 'Nomor telepon valid tidak ditemukan. Minta owner memberi nomor atau reply pesan target.';
    }

    const seconds = normalizeCallSeconds(
      args?.seconds ?? DEFAULT_CALL_SECONDS
    );
    if (seconds === null) {
      return `Durasi harus 1-${MAX_CALL_SECONDS} detik.`;
    }

    try {
      const { peerJid } = await placeMiscall(client, targets, seconds);
      return `${peerJid} dipanggil ${seconds} detik, lalu ditutup.`;
    } catch (err) {
      logger.error('[AI_SKILL]', `call_number failed: ${err.message}`);
      return `Panggilan gagal: ${describeCallError(err)}`;
    }
  },
});
