import { BotTexts, localeOf } from '../texts.js';
import * as userRepository from '../../db/repositories/userRepository.js';
import * as publicationRepository from '../../db/repositories/publicationRepository.js';

/**
 * /language, /cancel, /status
 * ملاحظة: /cancel يلغي محادثة المعاينة الحالية إن وُجدت (state) ويُلغي أي طلب معلّق.
 */
export function registerMiscCommands(bot, deps) {
  bot.command('language', async (ctx) => {
    const current = ctx.state.user.preferred_locale;
    const next = current === 'ar' ? 'en' : 'ar';
    await userRepository.updateLocale(ctx.state.user.id, next);
    ctx.state.user.preferred_locale = next;

    return ctx.reply(BotTexts.languageChanged[next]);
  });

  bot.command('status', async (ctx) => {
    const locale = localeOf(ctx.state.user);
    const publications = await publicationRepository.listForUser(ctx.state.user.id, { limit: 1 });

    if (publications.length === 0) {
      return ctx.reply(BotTexts.statusNone[locale]);
    }

    const latest = publications[0];
    const statusLabels = {
      published: { ar: '✅ منشور', en: '✅ published' },
      failed: { ar: '⛔ فشل', en: '⛔ failed' },
      pending: { ar: '⏳ بانتظار التأكيد', en: '⏳ pending' },
      publishing: { ar: '⏳ جارٍ النشر', en: '⏳ publishing' },
      cancelled: { ar: '❌ ملغى', en: '❌ cancelled' }
    };

    const label = statusLabels[latest.status]?.[locale] || latest.status;
    return ctx.reply(
      locale === 'ar'
        ? `📊 **حالة آخر عملية نشر**\n\nالحالة: ${label}\nالقناة: ${latest.channel_title || latest.telegram_chat_id}\n${latest.error_code ? `رمز الخطأ: ${latest.error_code}` : ''}`
        : `📊 **Last publication**\n\nStatus: ${label}\nChannel: ${latest.channel_title || latest.telegram_chat_id}\n${latest.error_code ? `Error: ${latest.error_code}` : ''}`,
      { parse_mode: 'Markdown' }
    );
  });

  bot.command('cancel', async (ctx) => {
    const state = ctx.state.user;
    const pending = ctx.state.previewFlow;

    if (pending?.publicationId) {
      try {
        await deps.publishingService.cancel(pending.publicationId, state.id);
      } catch {
        // إن لم يكن معلّقًا نكمل
      }
      ctx.state.previewFlow = null;
    }

    return ctx.reply(BotTexts.cancelled[localeOf(state)]);
  });
}
