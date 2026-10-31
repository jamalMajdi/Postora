import { Router } from 'express';
import { localeUpdateSchema } from '@postora/shared';
import { validate } from '../middleware/validate.js';
import { publicUser } from '../../services/authService.js';
import * as userRepository from '../../db/repositories/userRepository.js';
import * as draftRepository from '../../db/repositories/draftRepository.js';
import * as channelRepository from '../../db/repositories/channelRepository.js';
import * as publicationRepository from '../../db/repositories/publicationRepository.js';

/** مسارات المستخدم الحالي ولوحة التحكم. */
export function createMeRoutes() {
  const router = Router();

  /** GET /api/me — بيانات المستخدم + إحصاءات لوحة التحكم. */
  router.get('/', async (req, res, next) => {
    try {
      const [draftsCount, channels, stats] = await Promise.all([
        draftRepository.countForUser(req.user.id),
        channelRepository.listForUser(req.user.id),
        publicationRepository.statsForUser(req.user.id)
      ]);

      res.json({
        ok: true,
        data: {
          user: publicUser(req.user),
          stats: {
            draftsCount,
            channelsCount: channels.length,
            publishedCount: stats.published,
            failedCount: stats.failed
          }
        }
      });
    } catch (error) {
      next(error);
    }
  });

  /** PATCH /api/me/locale — تغيير اللغة المفضلة. */
  router.patch('/locale', validate(localeUpdateSchema), async (req, res, next) => {
    try {
      const updated = await userRepository.updateLocale(req.user.id, (req.validated?.body ?? req.body).locale);
      res.json({ ok: true, data: { user: publicUser(updated) } });
    } catch (error) {
      next(error);
    }
  });

  return router;
}
