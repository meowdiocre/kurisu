import { firstOrCreate } from '@kurisu/core/services/database';

/**
 * @param {import('knex').Knex} knex
 * @returns {Promise<void>}
 */
export async function seed(knex) {
  await firstOrCreate(
    knex('bots'),
    { id: 1 },
    {
      owners: JSON.stringify(['6285174902345', '210900309037136']),
      prefixes: JSON.stringify(['!', '.', '#']),
      kurisu_girlfriend: JSON.stringify([]),
      kurisu_18: JSON.stringify([]),
      self: false,
    }
  );
}
