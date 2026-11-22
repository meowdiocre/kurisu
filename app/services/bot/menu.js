import { getAllCommands } from './registry.js';

/**
 * @typedef {Object} MenuItem
 * @property {string} name - Command name
 * @property {string} group - Category label (e.g. 'group', 'utility', 'owner')
 * @property {string[]} commands - Command triggers or aliases
 * @property {boolean} withoutPrefix - Whether the command runs without a prefix
 * @property {string} description - Indonesian description shown to users
 * @property {string} usage - Usage pattern without the prefix
 * @property {string[]} examples - Example command lines without the prefix
 * @property {string} access - 'semua' | 'admin' | 'owner' | 'admin/owner'
 */

const cleanDescription = (value) =>
  String(value || '')
    .replace(/\s+/g, ' ')
    .trim();

const accessLabel = (middlewares = []) => {
  const senderRule = middlewares.find((rule) =>
    String(rule).toLowerCase().startsWith('sender:')
  );
  if (!senderRule) return 'semua';

  const roles = senderRule
    .slice('sender:'.length)
    .split(',')
    .map((role) => role.trim().toLowerCase())
    .filter(Boolean);

  if (roles.length === 1 && roles[0] === 'isowner') return 'owner';
  if (roles.includes('isowner')) return 'admin/owner';
  if (roles.includes('admin') || roles.includes('superadmin')) return 'admin';
  return 'semua';
};

const withPrefix = (item, value, prefix) =>
  item.withoutPrefix ? value : `${prefix}${value}`;

/**
 * Ambil semua command yang terdaftar, dikelompokkan per kategori.
 *
 * @returns {Promise<Map<string, MenuItem[]>>}
 */
export async function getMenuByLabel() {
  const groups = new Map();
  const commands = await getAllCommands();

  for (const cmd of commands) {
    if (!cmd.name || cmd.hidden) continue;

    const description = cleanDescription(cmd.description);
    // Command tanpa deskripsi dianggap internal dan tidak ditampilkan.
    if (!description) continue;

    const aliases = Array.isArray(cmd.aliases)
      ? cmd.aliases.map((alias) => String(alias).trim()).filter(Boolean)
      : [];

    if (aliases.length === 0) continue;

    const orderedAliases = aliases.includes(cmd.name)
      ? [cmd.name, ...aliases.filter((alias) => alias !== cmd.name)]
      : aliases;

    const groupName = (cmd.category || 'general').trim().toLowerCase();

    /** @type {MenuItem} */
    const item = {
      name: cmd.name,
      group: groupName,
      commands: orderedAliases,
      withoutPrefix: Boolean(cmd.withoutPrefix || cmd.prefix === false),
      description,
      usage: cleanDescription(cmd.usage),
      examples: Array.isArray(cmd.examples)
        ? cmd.examples.map(cleanDescription).filter(Boolean)
        : [],
      access: accessLabel(cmd.middlewares || []),
    };

    if (!groups.has(groupName)) {
      groups.set(groupName, []);
    }
    groups.get(groupName).push(item);
  }

  for (const items of groups.values()) {
    items.sort((a, b) => a.commands[0].localeCompare(b.commands[0]));
  }

  return groups;
}

const itemLine = (item, prefix) => {
  const primary = `${withPrefix(item, item.commands[0], prefix)}`;
  return `• \`${primary}\`: ${item.description}`;
};

const detailText = (item, prefix) => {
  const aliases = item.commands
    .map((alias) => `\`${withPrefix(item, alias, prefix)}\``)
    .join(', ');
  const usageLine = item.usage
    ? withPrefix(item, item.usage, prefix)
    : withPrefix(item, item.commands[0], prefix);

  const lines = [
    `｢ *${item.name}* ｣`,
    `• Kategori: ${item.group}`,
    `• Akses: ${item.access}`,
    `• Alias: ${aliases}`,
    `• Usage: \`${usageLine}\``,
    `• Deskripsi: ${item.description}`,
  ];

  if (item.examples.length > 0) {
    lines.push('• Contoh:');
    for (const example of item.examples) {
      lines.push(`  - \`${withPrefix(item, example, prefix)}\``);
    }
  }

  return lines.join('\n');
};

/**
 * Format teks menu untuk WhatsApp.
 *
 * @param {object} options
 * @param {string} [options.prefix='.'] - Prefix bot
 * @param {string} [options.userName='User'] - Nama tampilan pengguna
 * @param {string} [options.groupFilter] - Nama kategori atau command
 * @returns {Promise<string>}
 */
export async function formatMenuText({
  prefix = '.',
  userName = 'User',
  groupFilter = '',
} = {}) {
  const groups = await getMenuByLabel();

  if (groups.size === 0) {
    return 'Belum ada menu yang terdaftar.';
  }

  const cleanPrefix = prefix === 'optional' || !prefix ? '' : prefix;
  let filter = String(groupFilter || '')
    .trim()
    .toLowerCase();
  let commandOnly = false;

  if (filter.startsWith('command ')) {
    commandOnly = true;
    filter = filter.slice('command '.length).trim();
  }

  if (filter && filter !== 'all' && filter !== 'semua') {
    if (!commandOnly) {
      for (const [groupName, items] of groups.entries()) {
        if (groupName.toLowerCase() === filter) {
          const lines = [
            `｢ *${groupName}* ｣`,
            ...items.map((item) => itemLine(item, cleanPrefix)),
          ];
          return lines.join('\n');
        }
      }
    }

    for (const items of groups.values()) {
      const item = items.find(
        (entry) =>
          entry.name.toLowerCase() === filter ||
          entry.commands.some((alias) => alias.toLowerCase() === filter)
      );
      if (item) return detailText(item, cleanPrefix);
    }

    const categories = [...groups.keys()].sort().join(', ');
    return [
      `Kategori/command *${filter}* tidak ditemukan.`,
      `Kategori tersedia: ${categories}`,
      `Contoh: \`${cleanPrefix}menu call\` atau \`${cleanPrefix}menu command owner\``,
    ].join('\n');
  }

  let totalCommands = 0;
  const sections = [];
  const sortedGroupNames = [...groups.keys()].sort();

  for (const groupName of sortedGroupNames) {
    const items = groups.get(groupName) || [];
    totalCommands += items.length;

    const lines = [
      `｢ *${groupName}* ｣`,
      ...items.map((item) => itemLine(item, cleanPrefix)),
    ];
    sections.push(lines.join('\n'));
  }

  const header = [
    '*KURISU BOT MENU*',
    `Halo, *${userName}*!`,
    '',
    `Prefix: \`${cleanPrefix || 'tanpa prefix'}\` | Total: *${totalCommands}* fitur`,
  ].join('\n');

  const footer = [
    `_Ketik \`${cleanPrefix || ''}menu <kategori>\` untuk filter,_`,
    `_atau \`${cleanPrefix || ''}menu <command>\` untuk detail._`,
  ].join('\n');

  return [header, '', sections.join('\n\n'), '', footer].join('\n');
}

export default {
  getMenuByLabel,
  formatMenuText,
};
