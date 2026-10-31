import { Router } from 'express';
import { z } from 'zod';
import { validate } from '../middleware/validate.js';
import { authLimiter } from '../middleware/rateLimit.js';
import { publicUser } from '../../services/authService.js';

const initDataSchema = z.object({
  initData: z.string().min(1)
});

/**
 * مسارات المصادقة.
 * @param {{authService: object}} deps
 */
export function createAuthRoutes({ authService }) {
  const router = Router();

  /**
   * POST /api/auth/session
   * الجسم: { initData }
   * يتحقق من initData على الخادم ويصدر JWT قصير العمر.
   */
  router.post('/session', authLimiter, validate(initDataSchema), async (req, res, next) => {
    try {
      const session = await authService.createSessionFromInitData((req.validated?.body ?? req.body).initData);
      res.json({
        ok: true,
        data: {
          token: session.token,
          expiresIn: session.expiresIn,
          user: session.user
        }
      });
    } catch (error) {
      next(error);
    }
  });

  /**
   * GET /api/auth/me — للتحقق من صلاحية الجلسة الحالية.
   * (يعتمد على middleware المصادقة في الراوتر الرئيسي)
   */
  router.get('/me', async (req, res) => {
    res.json({ ok: true, data: { user: publicUser(req.user) } });
  });

  return router;
}
