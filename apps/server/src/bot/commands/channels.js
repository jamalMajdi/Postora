import { BotTexts, localeOf } from '../texts.js';

/**
 * /channels — يعرض قنوات المستخدم وحالة صلاحيات البوت فيها.
 * يقرأ من قاعدة البيانات (للعرض فقط) ويذكّر أن الفحص النهائي يحدث عند النشر.
 */
export function registerChannelsCommand(bot, deps) {
  bot.command('channels', async (ctx) => {
    const locale = localeOf(ctx.state.user);
    const channels = await deps.channelService.listChannels(ctx.state.user.id);

    if (channels.length === 0) {
      const text = BotTexts.noChannels[locale].replace('%BOT%', deps.config.bot.username);
      return ctx.reply(text, { parse_mode: 'Markdown', link_preview_options: { is_disabled: true } });
    }

    const text = BotTexts.channelsList[locale](channels);
    return ctx.reply(text, { parse_mode: 'Markdown', link_preview_options: { is_disabled: true } });
  });
}
