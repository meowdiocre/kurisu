import 'dotenv/config';
import fs from 'node:fs/promises';
import path from 'node:path';
import { getMenuByLabel } from '#app/services/bot/menu.js';

const PREFIX = '.';

const cell = (value) => String(value).replace(/\|/g, '\\|');

const renderCommand = (item) => {
  const command = item.withoutPrefix ? item.commands[0] : `${PREFIX}${item.commands[0]}`;
  const aliases = item.commands
    .map((alias) => (item.withoutPrefix ? alias : `${PREFIX}${alias}`))
    .join(', ');
  const usage = item.usage
    ? item.withoutPrefix
      ? item.usage
      : `${PREFIX}${item.usage}`
    : command;

  return { command, aliases, usage };
};

const main = async () => {
  const groups = await getMenuByLabel();
  const sortedGroups = [...groups.keys()].sort();
  const total = sortedGroups.reduce(
    (sum, group) => sum + (groups.get(group)?.length || 0),
    0
  );

  const lines = [
    '# Daftar Command Kurisu',
    '',
    '> Digenerate otomatis dari metadata command. Jangan edit manual.',
    '> Regenerate dengan `npm run docs:commands`.',
    '',
    `Prefix default: \`${PREFIX}\`. Prefix bisa diubah lewat \`${PREFIX}prefix\`.`,
    `Total: **${total}** command.`,
    '',
  ];

  for (const group of sortedGroups) {
    lines.push(`## ${group}`, '');
    lines.push('| Command | Alias | Usage | Akses | Deskripsi |');
    lines.push('|---|---|---|---|---|');

    for (const item of groups.get(group) || []) {
      const rendered = renderCommand(item);
      lines.push(
        `| \`${cell(rendered.command)}\` | ${rendered.aliases
          .split(', ')
          .map((alias) => `\`${cell(alias)}\``)
          .join(', ')} | \`${cell(rendered.usage)}\` | ${cell(item.access)} | ${cell(item.description)} |`
      );
    }

    lines.push('');
  }

  const target = path.join(process.cwd(), 'docs', 'COMMANDS.md');
  await fs.mkdir(path.dirname(target), { recursive: true });
  await fs.writeFile(target, `${lines.join('\n')}\n`, 'utf8');
  console.log(`Wrote ${target} (${total} commands)`);
};

await main();
