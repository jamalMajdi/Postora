import { Markup } from 'telegraf';
import { BotTexts, errorText, localeOf } from '../texts.js';
import { ErrorCode } from '@postora/shared';
import { getPreviewState, clearPreviewState } from './previewFlow.js';

/**
 * تدفق التأكيد والنشر.
 *
 * الحماية من التكرار:
 *  - حالة المعاينة تُستهلك فورًا عند الضغط على أي زر (لا ضغطتان).
 *  - طلب النشر يُنشأ بحالة pending ثم يُنفّذ بانتقال ذرّي في القاعدة.
 */
export function registerPublishFlow(bot, deps) {
  bot.action('flow:confirm', async (ctx) => {
    const locale = localeOf(ctx.state.user);
    const state = getPreviewState(ctx.state.user.telegram_user_id);

    await ctx.answerCbQuery();

    if (!state || state.stage !== 'awaiting_confirmation') {
      return ctx.reply(BotTexts.expired[locale]);
    }

    // نستهلك الحالة مباشرة (يمنع الضغط المزدوج)
    clearPreviewState(ctx.state.user.telegram_user_id);

    const channel = state.channels.find((c) => c.id === state.channelId);
    if (!channel) {
      return ctx.reply(errorText(ErrorCode.CHANNEL_NOT_OWNED, locale));
    }

    await ctx.reply(BotTexts.publishing[locale]);

    try {
      const { publication } = await deps.publishingService.preparePublication({
        user: ctx.state.user,
        channelId: channel.id,
        contentMarkdown: state.markdown,
        source: 'bot',
        allowDuplicate: false
      });

      const result = await deps.publishingService.executePublication({
        user: ctx.state.user,
        publicationId: publication.id,
        contentMarkdown: state.markdown
      });

      return ctx.reply(
        BotTexts.published[locale](result.messageIds.length, channel.title),
        { parse_mode: 'Markdown' }
      );
    } catch (error) {
      // تحذير التكرار المتعمد → نعرض زر تأكيد صريح
      if (error?.code === ErrorCode.PUBLICATION_DUPLICATE_WARNING) {
        return ctx.reply(
          BotTexts.duplicateWarning[locale],
          Markup.inlineKeyboard([
            [
              Markup.button.callback(
                locale === 'ar' ? '⚠️ تأكيد النشر المكرر' : '⚠️ Confirm duplicate',
                'flow:confirm_duplicate'
              )
            ],
            [Markup.button.callback(locale === 'ar' ? '❌ إلغاء' : '❌ Cancel', 'flow:cancel')]
          ])
        );
      }
      throw error;
    }
  });

  bot.action('flow:confirm_duplicate', async (ctx) => {
    const locale = localeOf(ctx.state.user);
    await ctx.answerCbQuery();

    // الحالة استُهلكت؛ نطلب من المستخدم إعادة الإرسال لأن المحتوى لم يبق محفوظًا
    return ctx.reply(
      locale === 'ar'
        ? 'ℹ️ لإعادة نشر نفس المحتوى عمدًا، أعد إرسال الملف ثم اضغط "تأكيد النشر" مرة أخرى عبر التطبيق المصغر أو استخدم خيار النشر المكرر هناك.'
        : 'ℹ️ To republish intentionally, resend the file and confirm again, or use the duplicate option in the Mini App.'
    );
  });

  bot.action('flow:cancel', async (ctx) => {
    const locale = localeOf(ctx.state.user);
    clearPreviewState(ctx.state.user.telegram_user_id);
    await ctx.answerCbQuery();
    return ctx.reply(BotTexts.cancelled[locale]);
  });
}
