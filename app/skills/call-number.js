import { defineSkill } from '#app/services/ai/skill.js';
import logger from '@kurisu/core/utils/logger';
import {
  DEFAULT_CALL_SECONDS,
  MAX_CALL_SECONDS,
  normalizeCallSeconds,
  placeMiscall,
  resolveCallTarget,
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
      return 'Call skill is not available in this chat.';
    }

    if (!msg.permissions?.sender?.isOwner) {
      return 'Owner only: miscall is restricted to bot owners.';
    }

    const target = resolveCallTarget(
      msg,
      typeof args?.target === 'string' ? args.target : ''
    );
    if (!target) {
      return 'No valid phone number was found. Ask the owner for a number or reply to the target message.';
    }

    const seconds = normalizeCallSeconds(
      args?.seconds ?? DEFAULT_CALL_SECONDS
    );
    if (seconds === null) {
      return `Duration must be 1-${MAX_CALL_SECONDS} seconds.`;
    }

    try {
      await placeMiscall(client, target, seconds);
      return `Rang ${target} for ${seconds} seconds, then hung up.`;
    } catch (err) {
      logger.error('[AI_SKILL]', `call_number failed: ${err.message}`);
      return `Call failed: ${err.message}`;
    }
  },
});
