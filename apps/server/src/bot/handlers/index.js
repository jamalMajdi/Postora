import { BotTexts, localeOf } from '../texts.js';

/**
 * معالجات عامة: نصوص غير معروفة، أخطاء تحميل الملفات، إلخ.
 * كلها رسائل تعليمية قصيرة بدل الصمت.
 */
export function registerGeneralHandlers(bot, deps) {
  bot.on('text', async (ctx, next) => {
    // نتجاهل الأوامر (تُعالج في مكان آخر)
    if (ctx.message.text?.startsWith('/')) return next();

    const locale = localeOf(ctx.state.user);
    return ctx.reply(BotTexts.sendFileOnly[locale], { parse_mode: 'Markdown' });
  });

  bot.on('photo', async (ctx) => {
    const locale = localeOf(ctx.state.user);
    return ctx.reply(BotTexts.sendFileOnly[locale], { parse_mode: 'Markdown' });
  });

  bot.catch((error, ctx) => {
    deps.logger.error(
      { err: { message: error?.message, name: error?.name }, updateType: ctx?.updateType },
      'unhandled bot error'
    );
  });
}
