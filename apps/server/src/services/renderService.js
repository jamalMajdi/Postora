import { renderToTelegram, WarningCode } from '@postora/markdown-engine';
import { AppError } from '../errors/AppError.js';
import { ErrorCode } from '@postora/shared';

/**
 * خدمة التحويل: الغلاف الوحيد حول محرك Markdown في الخادم.
 * البوت والميني آب (عبر API) يمرّان من هنا — لا منطق تنسيق مكرر في أي مكان آخر.
 */

/**
 * يحوّل Markdown إلى رسائل تلجرام جاهزة مع التحقق من الحدود.
 *
 * @param {string} markdown
 * @param {{maxMessages: number, maxContentChars?: number, maxChars?: number, softLimit?: number}} limits
 * @returns {{
 *   messages: Array<{text:string, entities:any[], html:string, length:number}>,
 *   warnings: Array<{code:string,messageAr:string,messageEn:string,count:number}>,
 *   stats: object,
 *   needsReview: boolean
 * }}
 */
export function renderMarkdown(markdown, limits) {
  if (typeof markdown !== 'string') {
    throw new AppError(ErrorCode.VALIDATION_ERROR);
  }

  // نقبل الاسمين (maxContentChars من الإعدادات، maxChars للاختبارات/الاستخدام المباشر)
  const maxChars = limits.maxContentChars ?? limits.maxChars ?? Number.POSITIVE_INFINITY;
  if (markdown.length > maxChars) {
    throw new AppError(ErrorCode.CONTENT_TOO_LONG, {
      details: { maxChars, actualChars: markdown.length }
    });
  }

  let result;
  try {
    result = renderToTelegram(markdown, {
      maxMessages: limits.maxMessages,
      softLimit: limits.softLimit
    });
  } catch (error) {
    if (error.code === 'TOO_MANY_MESSAGES') {
      throw new AppError(ErrorCode.TOO_MANY_MESSAGES, {
        details: error.details,
        status: 413
      });
    }
    if (error.code === 'RENDER_NEEDS_REVIEW') {
      throw new AppError(ErrorCode.RENDER_NEEDS_REVIEW, { details: error.details, status: 413 });
    }
    throw new AppError(ErrorCode.RENDER_FAILED, {
      internalMessage: error.message,
      cause: error
    });
  }

  const needsReview = result.warnings.some((w) => w.code === WarningCode.TABLE_AS_MONOSPACE);

  return {
    messages: result.messages,
    warnings: result.warnings,
    stats: result.stats,
    needsReview
  };
}

/**
 * ملخص مقروء للمستخدم (يُستخدم في معاينة البوت).
 */
export function describeRenderSummary(result, locale = 'ar') {
  const { stats } = result;
  if (stats.messagesCount === 0) {
    return locale === 'ar' ? 'لا يوجد محتوى للنشر.' : 'There is no content to publish.';
  }
  const messagesLine =
    locale === 'ar'
      ? `📊 سيُنشر في ${stats.messagesCount} رسالة — إجمالي ${stats.totalChars.toLocaleString('en-US')} حرفًا.`
      : `📊 Will be published as ${stats.messagesCount} message(s) — ${stats.totalChars.toLocaleString('en-US')} characters total.`;
  return messagesLine;
}
