import { AppError } from '../../errors/AppError.js';
import { ErrorCode } from '@postora/shared';

/**
 * Middleware المصادقة.
 * يقبل: Authorization: Bearer <jwt>  أو  X-Telegram-Init-Data: <initData>
 * الهوية تُستخرج على الخادم فقط — أي user id في جسم الطلب يُتجاهل تمامًا.
 */
export function createAuthenticate(authService) {
  return async function authenticate(req, _res, next) {
    try {
      const bearer = extractBearer(req.headers.authorization);

      if (bearer) {
        const user = await authService.authenticateToken(bearer);
        req.user = user;
        return next();
      }

      const initData =
        req.headers['x-telegram-init-data'] ||
        (typeof req.body?.initData === 'string' ? req.body.initData : null);

      if (initData) {
        const session = await authService.createSessionFromInitData(initData);
        // نعيد المستخدم من قاعدة البيانات لتوحيد الشكل
        req.user = await authService.authenticateToken(session.token);
        req.session = session;
        return next();
      }

      throw new AppError(ErrorCode.AUTH_MISSING_INIT_DATA);
    } catch (error) {
      return next(error);
    }
  };
}

function extractBearer(header) {
  if (!header || typeof header !== 'string') return null;
  const match = /^Bearer\s+(.+)$/i.exec(header.trim());
  return match ? match[1] : null;
}
