/**
 * @param {import('knex').Knex} knex
 * @returns {Promise<void>}
 */
export async function up(knex) {
  const hasTable = await knex.schema.hasTable('bots');
  if (!hasTable) return;

  const hasGirlfriend = await knex.schema.hasColumn(
    'bots',
    'kurisu_girlfriend'
  );
  const hasAdult = await knex.schema.hasColumn('bots', 'kurisu_18');

  await knex.schema.alterTable('bots', (table) => {
    if (!hasGirlfriend) table.json('kurisu_girlfriend').nullable();
    if (!hasAdult) table.json('kurisu_18').nullable();
  });
}

/**
 * @param {import('knex').Knex} knex
 * @returns {Promise<void>}
 */
export async function down(knex) {
  const hasTable = await knex.schema.hasTable('bots');
  if (!hasTable) return;

  const hasGirlfriend = await knex.schema.hasColumn(
    'bots',
    'kurisu_girlfriend'
  );
  const hasAdult = await knex.schema.hasColumn('bots', 'kurisu_18');

  await knex.schema.alterTable('bots', (table) => {
    if (hasGirlfriend) table.dropColumn('kurisu_girlfriend');
    if (hasAdult) table.dropColumn('kurisu_18');
  });
}
