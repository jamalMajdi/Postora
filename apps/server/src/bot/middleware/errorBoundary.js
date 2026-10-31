import { AppError, isAppError } from '../../errors/AppError.js';
import { ErrorCode } from '@postora/shared';
import { errorText, localeOf } from '../texts.js';

/**
 * حدود الأخطاء للبوت: أي خطأ داخل أي معالج يُترجم إلى رسالة عربية واضحة،
 * ولا يُسقط عملية البوت. التفاصيل تُسجّل فقط (بعد تنقية الأسرار).
 */
export function errorBoundary(logger) {
  return async function errorBoundaryMiddleware(ctx, next) {
    try {
      await next();
    } catch (error) {
      if (process.env.NODE_ENV === 'test') {
        console.error(
          '[bot test] error:',
          error?.code || error?.name,
          '|',
          error?.message,
          '|',
          error?.stack?.split('\n').slice(1, 3).join(' <- ')
        );
      }
      const locale = localeOf(ctx.state?.user);
      const code = isAppError(error) ? error.code : ErrorCode.INTERNAL_ERROR;

      logger.warn(
        {
          code,
          updateType: ctx.updateType,
          chatType: ctx.chat?.type,
          userId: ctx.state?.user?.id,
          details: isAppError(error) ? error.details : undefined,
          message: error?.message
        },
        'bot handler error'
      );

      const text =
        isAppError(error) && error.partialMessageIds?.length
          ? `${errorText(code, locale)}\n\n${partialNote(error.partialMessageIds.length, locale)}`
          : errorText(code, locale);

      try {
        if (ctx.callbackQuery) {
          await ctx.answerCbQuery().catch(() => {});
        }
        await ctx.reply(text, { link_preview_options: { is_disabled: true } });
      } catch {
        // إن فشل الرد نفسه (مثلاً حجب البوت) لا نفعل شيئًا
      }
    }
  };
}

function partialNote(count, locale) {
  return locale === 'ar'
    ? `ℹ️ نُشر ${count} رسالة قبل الفشل. لم يُعَد إرسالها تلقائيًا لتجنب التكرار.`
    : `ℹ️ ${count} message(s) were sent before the failure. They were not resent automatically to avoid duplicates.`;
}

export { AppError };
