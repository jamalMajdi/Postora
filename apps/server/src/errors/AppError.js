import { ErrorCode, getUserMessage } from '@postora/shared';

/**
 * خطأ تطبيقي موحّد.
 * - code: رمز من ErrorCode (يُعرض للواجهة)
 * - details: تفاصيل داخلية للسجلات فقط (لا تُرسل للمستخدم)
 * - expose: هل يمكن إظهار رسالة الخطأ للمستخدم؟
 */
export class AppError extends Error {
  /**
   * @param {string} code
   * @param {object} [options]
   * @param {number} [options.status]
   * @param {string} [options.internalMessage]
   * @param {object} [options.details]
   * @param {Error} [options.cause]
   */
  constructor(code, options = {}) {
    super(options.internalMessage || code);
    this.name = 'AppError';
    this.code = code;
    this.status = options.status ?? statusForCode(code);
    this.details = options.details || null;
    this.expose = true;
    if (options.cause) this.cause = options.cause;
  }

  /** جسم الاستجابة الآمن للمستخدم. */
  toResponse(locale = 'ar') {
    return {
      ok: false,
      error: {
        code: this.code,
        message: getUserMessage(this.code, locale),
        details: this.details && this.expose ? this.details : undefined
      }
    };
  }
}

export function statusForCode(code) {
  switch (code) {
    case ErrorCode.VALIDATION_ERROR:
      return 400;
    case ErrorCode.AUTH_MISSING_INIT_DATA:
    case ErrorCode.AUTH_INVALID_INIT_DATA:
    case ErrorCode.AUTH_EXPIRED_INIT_DATA:
    case ErrorCode.AUTH_INVALID_TOKEN:
    case ErrorCode.AUTH_EXPIRED_TOKEN:
      return 401;
    case ErrorCode.USER_BLOCKED:
    case ErrorCode.CHANNEL_NOT_OWNED:
    case ErrorCode.CHANNEL_ACCESS_DENIED:
    case ErrorCode.CHANNEL_BOT_NOT_ADMIN:
    case ErrorCode.CHANNEL_BOT_CANNOT_POST:
    case ErrorCode.TELEGRAM_FORBIDDEN:
      return 403;
    case ErrorCode.NOT_FOUND:
    case ErrorCode.CHANNEL_NOT_FOUND:
    case ErrorCode.PUBLICATION_NOT_FOUND:
      return 404;
    case ErrorCode.PUBLICATION_NOT_PENDING:
    case ErrorCode.PUBLICATION_ALREADY_PROCESSED:
    case ErrorCode.PUBLICATION_DUPLICATE_WARNING:
      return 409;
    case ErrorCode.FILE_TOO_LARGE:
    case ErrorCode.CONTENT_TOO_LONG:
    case ErrorCode.TOO_MANY_MESSAGES:
    case ErrorCode.RENDER_NEEDS_REVIEW:
      return 413;
    case ErrorCode.RATE_LIMITED:
    case ErrorCode.TELEGRAM_RATE_LIMITED:
      return 429;
    default:
      return 400;
  }
}

export function isAppError(error) {
  return error instanceof AppError;
}
