import { AppError, isAppError } from '../../errors/AppError.js';
import { ErrorCode } from '@postora/shared';

/**
 * معالج الأخطاء المركزي.
 * - لا يكشف stack traces أو تفاصيل داخلية للمستخدم.
 * - يسجّل التفاصيل الكاملة داخليًا (مع تنقية الأسرار في logger).
 */
export function createErrorHandler(logger) {
  // eslint-disable-next-line no-unused-vars
  return function errorHandler(error, req, res, next) {
    const locale = req.user?.preferred_locale || 'ar';

    if (isAppError(error)) {
      // أخطاء 4xx متوقعة: نُسجّلها بمستوى منخفض
      const level = error.status >= 500 ? 'error' : 'warn';
      logger[level](
        {
          code: error.code,
          status: error.status,
          path: req.originalUrl,
          method: req.method,
          details: error.details
        },
        error.message
      );

      const body = error.toResponse(locale);
      if (error.publication) {
        body.error.publication = error.publication;
      }
      return res.status(error.status).json(body);
    }

    // خطأ غير متوقع
    logger.error(
      { err: { message: error?.message, name: error?.name, stack: error?.stack }, path: req.originalUrl },
      'unhandled error'
    );

    return res.status(500).json(new AppError(ErrorCode.INTERNAL_ERROR).toResponse(locale));
  };
}

/** مسار غير موجود. */
export function notFoundHandler(req, _res, next) {
  next(new AppError(ErrorCode.NOT_FOUND, { details: { path: req.originalUrl } }));
}
