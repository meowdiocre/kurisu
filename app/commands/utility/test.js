import { defineCommand } from '#app/services/bot/index.js';

export default defineCommand({
  name: 'test',
  aliases: ['test'],
  category: 'utility',
  description: 'Command debug internal (tidak ditampilkan di menu)',
  hidden: true,

  async execute(payload, ctx) {
    console.log(ctx);
  },
});
