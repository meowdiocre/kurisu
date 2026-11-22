import { defineSkill } from '#app/services/ai/skill.js';
import { formatReminderTime, listReminders } from '#app/services/reminder.js';

export default defineSkill({
  name: 'list_reminders',
  description:
    "List the current user's active and paused reminders with their ids, schedules, modes, and next run. Use when the user asks what reminders they have.",
  parameters: {
    type: 'object',
    properties: {},
  },
  async execute(args, context) {
    const { msg, ctx } = context || {};
    const sessionId = ctx?.sessionId || process.env.SESSION_ID;
    if (!msg || !sessionId) {
      return 'Daftar pengingat tidak tersedia di chat ini.';
    }

    const reminders = await listReminders({
      sessionId,
      sender: msg.sender,
    });

    if (reminders.length === 0) {
      return 'Belum ada pengingat aktif.';
    }

    const lines = reminders.map((reminder) => {
      const mode = reminder.mode === 'ai' ? 'AI' : 'statis';
      const call = reminder.call_seconds
        ? ` | miscall ${reminder.call_seconds} detik`
        : '';
      const status = reminder.status === 'paused' ? ' | dijeda' : '';
      return `- id ${reminder.id}: ${reminder.schedule_text || reminder.frequency} | ${reminder.message} | ${mode}${call}${status} | berikutnya ${formatReminderTime(reminder)}`;
    });

    return ['Pengingat aktif:', ...lines].join('\n');
  },
});
