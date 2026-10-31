import { Router } from 'express';
import { z } from 'zod';
import { channelConnectSchema, idSchema } from '@postora/shared';
import { validate } from '../middleware/validate.js';

const idParamSchema = z.object({ id: idSchema });

/** مسارات القنوات. */
export function createChannelRoutes({ channelService }) {
  const router = Router();

  router.get('/', async (req, res, next) => {
    try {
      const channels = await channelService.listChannels(req.user.id);
      res.json({ ok: true, data: { channels } });
    } catch (error) {
      next(error);
    }
  });

  /**
   * POST /api/channels — ربط قناة.
   * يتحقق حيًا من: وجود القناة، كون البوت أدمن، ملكية المستخدم لها.
   */
  router.post('/', validate(channelConnectSchema), async (req, res, next) => {
    try {
      const result = await channelService.connectChannel({
        user: req.user,
        chatRef: (req.validated?.body ?? req.body).chatRef
      });
      res.status(201).json({ ok: true, data: result });
    } catch (error) {
      next(error);
    }
  });

  /** إعادة فحص صلاحيات البوت على القناة. */
  router.post('/:id/verify', validate(idParamSchema, 'params'), async (req, res, next) => {
    try {
      const channel = await channelService.refreshPermissions(req.params.id, req.user.id);
      res.json({ ok: true, data: { channel } });
    } catch (error) {
      next(error);
    }
  });

  router.delete('/:id', validate(idParamSchema, 'params'), async (req, res, next) => {
    try {
      const result = await channelService.disconnectChannel(req.params.id, req.user.id);
      res.json({ ok: true, data: result });
    } catch (error) {
      next(error);
    }
  });

  return router;
}
