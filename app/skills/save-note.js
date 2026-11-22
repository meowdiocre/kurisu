import { defineSkill } from '#app/services/ai/skill.js';
import {
  MAX_NOTE_CONTENT_LENGTH,
  MAX_NOTE_NAME_LENGTH,
  MAX_PERSONAL_NOTES,
  MAX_GROUP_NOTES,
  normalizeNoteName,
  saveNote,
} from '#app/services/note.js';
import {
  getNoteSkillSession,
  quotedNoteText,
} from './note-context.js';
import { isGroupAdmin } from '#app/utils/roles.js';

export default defineSkill({
  name: 'save_note',
  description:
    'Save or update a named note. Use scope "personal" for the current user\'s private notes; use scope "group" for notes shared with the current group. Personal notes in a group can only be saved by replying to a message. Group notes can only be written by group admins.',
  parameters: {
    type: 'object',
    properties: {
      name: {
        type: 'string',
        description: `Short note name, maximum ${MAX_NOTE_NAME_LENGTH} characters. Examples: "deploy", "wifi-kos".`,
      },
      content: {
        type: 'string',
        description: `Note content, maximum ${MAX_NOTE_CONTENT_LENGTH} characters. Omit when the user replied to the message that should be saved.`,
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

    const scope = String(args?.scope || '').toLowerCase();
    if (scope !== 'personal' && scope !== 'group') {
      return 'Scope harus "personal" atau "group".';
    }

    const name = normalizeNoteName(args?.name);
    if (!name) {
      return `Nama catatan tidak valid. Gunakan huruf, angka, strip, atau underscore, maksimal ${MAX_NOTE_NAME_LENGTH} karakter.`;
    }

    let content = String(args?.content || '').trim();

    if (scope === 'personal' && msg.flags?.isGroup) {
      if (!msg.quoted) {
        return 'Catatan personal di grup hanya bisa disimpan dengan reply pesan.';
      }
      content = quotedNoteText(msg);
    } else if (!content) {
      content = quotedNoteText(msg);
    }

    if (!content) {
      return `Isi catatan wajib diisi, maksimal ${MAX_NOTE_CONTENT_LENGTH} karakter.`;
    }

    if (scope === 'group') {
      if (!msg.flags?.isGroup) {
        return 'Catatan grup hanya bisa disimpan di chat grup.';
      }
      if (!isGroupAdmin(msg)) {
        return 'Hanya admin grup yang bisa menyimpan catatan grup.';
      }
    }

    const result = await saveNote({
      sessionId,
      scope,
      chatJid: msg.chat,
      sender: msg.sender,
      senderName: ctx?.tableGroupMember?.pushname || msg.sender?.name || null,
      name,
      content,
    });

    if (!result.ok) {
      switch (result.error) {
        case 'reserved_name':
          return `"${name}" adalah nama subcommand yang dipakai. Pilih nama lain.`;
        case 'invalid_content':
          return `Isi catatan wajib diisi, maksimal ${MAX_NOTE_CONTENT_LENGTH} karakter.`;
        case 'limit':
          return `Batas catatan ${scope} sudah tercapai (${scope === 'group' ? MAX_GROUP_NOTES : MAX_PERSONAL_NOTES}). Hapus catatan dulu.`;
        default:
          return 'Gagal menyimpan catatan.';
      }
    }

    return `${result.created ? 'Disimpan' : 'Diperbarui'} catatan ${scope} "${result.note.name}".`;
  },
});
