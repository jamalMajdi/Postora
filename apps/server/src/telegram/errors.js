import { ErrorCode } from '@postora/shared';

/**
 * ترميز أخطاء Telegram Bot API إلى رموز داخلية مفهومة.
 * لا نُظهر نص تلجرام الخام للمستخدم (قد يحتوي تفاصيل تقنية)، لكن نحتفظ به للسجلات.
 */

/**
 * @param {any} error خطأ Telegraf / fetch
 * @returns {{code: string, retryAfter: number|null, telegramMessage: string, httpStatus: number|null}}
 */
export function normalizeTelegramError(error) {
  const response = error?.response || error?.on?.payload || null;
  const httpStatus = response?.error_code ?? error?.code ?? null;
  const description = response?.description || error?.description || error?.message || '';

  let code = ErrorCode.PUBLISH_FAILED;
  let retryAfter = null;

  if (httpStatus === 429 || /too many requests/i.test(description)) {
    code = ErrorCode.TELEGRAM_RATE_LIMITED;
    retryAfter = response?.parameters?.retry_after ?? error?.response?.parameters?.retry_after ?? 5;
  } else if (httpStatus === 403 || /forbidden|not enough rights|bot is not a member|CHAT_WRITE_FORBIDDEN|not an administrator/i.test(description)) {
    code = ErrorCode.TELEGRAM_FORBIDDEN;
  } else if (httpStatus === 400 && /can't parse entities|unsupported|entity/i.test(description)) {
    code = ErrorCode.RENDER_FAILED;
  } else if (httpStatus === 400 && /chat not found/i.test(description)) {
    code = ErrorCode.CHANNEL_NOT_FOUND;
  } else if (httpStatus === 400 && /message is too long/i.test(description)) {
    code = ErrorCode.RENDER_NEEDS_REVIEW;
  }

  return {
    code,
    retryAfter: typeof retryAfter === 'number' ? retryAfter : null,
    telegramMessage: String(description).slice(0, 300),
    httpStatus: typeof httpStatus === 'number' ? httpStatus : null
  };
}

/** وصف فني قصير للسجلات فقط. */
export function describeTelegramError(error) {
  const normalized = normalizeTelegramError(error);
  return `${normalized.httpStatus ?? '-'} ${normalized.code}: ${normalized.telegramMessage}`;
}
