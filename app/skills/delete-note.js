import { defineSkill } from '#app/services/ai/skill.js';
import {
  deleteNote,
  normalizeNoteName,
} from '#app/services/note.js';
import {
  getNoteSkillSession,
  validateNoteReadScope,
} from './note-context.js';
import { isGroupAdmin } from '#app/utils/roles.js';

export default defineSkill({
  name: 'delete_note',
  description:
    'Delete a saved note by name. Use scope "personal" for the current user\'s private notes; use scope "group" for the current group\'s shared notes. Group notes can only be deleted by group admins.',
  parameters: {
    type: 'object',
    properties: {
      name: {
        type: 'string',
        description: 'Note name to delete.',
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

    if (scope === 'group' && !isGroupAdmin(msg)) {
      return 'Hanya admin grup yang bisa menghapus catatan grup.';
    }

    const name = normalizeNoteName(args?.name);
    if (!name) return 'Nama catatan tidak valid.';

    const deleted = await deleteNote({
      sessionId,
      scope,
      chatJid: msg.chat,
      sender: msg.sender,
      name,
    });

    return deleted
      ? `Catatan ${scope} "${name}" dihapus.`
      : `Catatan "${name}" tidak ditemukan.`;
  },
});
