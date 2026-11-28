import { KURISU } from '#app/services/ai/persona.js';
import { defineSkill } from '#app/services/ai/skill.js';
import {
  MAX_REMINDER_MESSAGE_LENGTH,
  createReminder,
  formatReminderTime,
} from '#app/services/reminder.js';

export default defineSkill({
  name: 'create_reminder',
  description:
    'Create a WhatsApp reminder for the current user in this chat. Use when the user asks to be reminded about something. Supports one-time, daily, and monthly schedules.',
  parameters: {
    type: 'object',
    properties: {
      schedule: {
        type: 'string',
        description:
          'Reminder schedule. Examples: "10m", "2h", "20:30", "2026-11-18 08:00", "daily 08:00", "monthly 1 09:00".',
      },
      message: {
        type: 'string',
        description: `The reminder intent or exact message, maximum ${MAX_REMINDER_MESSAGE_LENGTH} characters. Write it as the message that should reach the user, for example "bangun, udah waktunya" instead of "bangunin dia".`,
      },
      ai: {
        type: 'boolean',
        description:
          'Set true when the user wants Kurisu to rewrite the reminder naturally at delivery time instead of sending the exact static text.',
      },
    },
    required: ['schedule', 'message'],
  },
  async execute(args, context) {
    const { msg, ctx } = context || {};
    const sessionId = ctx?.sessionId || process.env.SESSION_ID;
    if (!msg || !sessionId) {
      return 'Skill pengingat tidak tersedia di chat ini.';
    }

    const result = await createReminder({
      sessionId,
      chatJid: msg.chat,
      sender: msg.sender,
      senderName: ctx?.tableGroupMember?.pushname || msg.sender?.name || null,
      message: args?.message,
      schedule: args?.schedule,
      ai: Boolean(args?.ai),
    });

    if (!result.ok) {
      if (result.error === 'limit') {
        return 'User sudah mencapai batas pengingat aktif.';
      }
      if (result.error === 'invalid_schedule') {
        return 'Format jadwal tidak valid. Gunakan contoh yang didukung.';
      }
      if (result.error === 'invalid_message') {
        return `Pesan pengingat harus 1-${MAX_REMINDER_MESSAGE_LENGTH} karakter.`;
      }
      return 'Gagal membuat pengingat.';
    }

    const reminder = result.reminder;
    return `Pengingat dijadwalkan. Berikutnya: ${formatReminderTime(reminder)}. Balas user natural dengan gaya ${KURISU.name}, satu kalimat pendek. Jangan sebut id atau field teknis kecuali user minta.`;
  },
});
