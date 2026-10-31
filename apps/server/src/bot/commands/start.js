import { BotTexts, localeOf } from '../texts.js';
import { openMiniAppKeyboard } from '../keyboards/common.js';

/**
 * /start — رسالة الترحيب وشرح الخطوات.
 */
export function registerStartCommand(bot, deps) {
  bot.start(async (ctx) => {
    const locale = localeOf(ctx.state.user);
    const text = BotTexts.start[locale](
      deps.config.bot.username,
      deps.config.miniappUrl
    );

    const keyboard = openMiniAppKeyboard(deps.config.miniappUrl, locale);

    return ctx.reply(text, {
      parse_mode: 'Markdown',
      link_preview_options: { is_disabled: true },
      ...(keyboard ? { reply_markup: keyboard.reply_markup } : {})
    });
  });
}
