import { defineSkill } from '#app/services/ai/skill.js';
import {
  formatNoteTime,
  getNote,
  normalizeNoteName,
} from '#app/services/note.js';
import {
  getNoteSkillSession,
  validateNoteReadScope,
} from './note-context.js';

export default defineSkill({
  name: 'get_note',
  description:
    'Read one saved note by name. Use scope "personal" for the current user\'s private notes; use scope "group" for the current group\'s shared notes. Personal notes cannot be read in a group.',
  parameters: {
    type: 'object',
    properties: {
      name: {
        type: 'string',
        description: 'Note name to read, for example "deploy" or "wifi-kos".',
      },
      scope: {
        type: 'string',
        enum: ['personal', 'group'],
        description:
          'Personal notes belong only to the current user. Group notes are shared with everyone in the current group.',
      },
    },
    required: ['name', 'scope'],
  },
  async execute(args, context) {
    const { msg, ctx } = context || {};
    const sessionId = getNoteSkillSession(ctx);
    if (!msg || !sessionId) {
      return 'Catatan tidak tersedia di chat ini.';
    }

    const scopeCheck = validateNoteReadScope(args?.scope, msg);
    if (scopeCheck.error) return scopeCheck.error;
    const scope = scopeCheck.scope;

    const name = normalizeNoteName(args?.name);
    if (!name) return 'Nama catatan tidak valid.';

    const note = await getNote({
      sessionId,
      scope,
      chatJid: msg.chat,
      sender: msg.sender,
      name,
    });

    if (!note) {
      return `Catatan "${name}" tidak ditemukan.`;
    }

    const lines = [`Catatan "${note.name}" (${scope})`];
    if (scope === 'group') {
      lines.push(
        `Penulis: ${note.author_name || 'tidak diketahui'}`,
        `Diperbarui: ${formatNoteTime(note)}`
      );
    }
    lines.push('', note.content);

    return lines.join('\n');
  },
});
