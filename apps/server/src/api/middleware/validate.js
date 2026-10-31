import { AppError } from '../../errors/AppError.js';
import { ErrorCode } from '@postora/shared';

/**
 * تحقق من المدخلات عبر مخطط Zod.
 * @param {import('zod').ZodTypeAny} schema
 * @param {'body'|'query'|'params'} source
 */
export function validate(schema, source = 'body') {
  return function validateMiddleware(req, _res, next) {
    const result = schema.safeParse(req[source]);

    if (!result.success) {
      const details = result.error.issues.map((issue) => ({
        path: issue.path.join('.'),
        message: issue.message
      }));
      return next(
        new AppError(ErrorCode.VALIDATION_ERROR, {
          details: { field: source, issues: details }
        })
      );
    }

    // ملاحظة: في Express 5 لا يمكن إسناد req.query (getter فقط).
    // لذلك نخزن البيانات المنقّاة في req.validated ولا نلمس المصدر الأصلي.
    req.validated = req.validated || {};
    req.validated[source] = result.data;
    return next();
  };
}
