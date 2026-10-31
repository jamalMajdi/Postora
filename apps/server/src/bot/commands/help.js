import { BotTexts, localeOf } from '../texts.js';

/** /help */
export function registerHelpCommand(bot) {
  bot.help(async (ctx) => {
    const locale = localeOf(ctx.state.user);
    return ctx.reply(BotTexts.help[locale], {
      parse_mode: 'Markdown',
      link_preview_options: { is_disabled: true }
    });
  });
}
