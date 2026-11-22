import { firstOrCreate } from '@kurisu/core/services/database';

/**
 * @param {import('knex').Knex} knex
 * @returns {Promise<void>}
 */
export async function seed(knex) {
  const owners = String(process.env.OWNER_NUMBERS || '')
    .split(',')
    .map((value) => value.replace(/[^0-9]/g, ''))
    .filter((value) => value.length >= 7);

  await firstOrCreate(
    knex('bots'),
    { id: 1 },
    {
      owners: JSON.stringify(owners),
      prefixes: JSON.stringify(['!', '.', '#']),
      kurisu_girlfriend: JSON.stringify([]),
      kurisu_18: JSON.stringify([]),
      self: false,
    }
  );
}
