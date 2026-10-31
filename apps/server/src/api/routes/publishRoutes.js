import { Router } from 'express';
import { z } from 'zod';
import {
  publishSchema,
  previewSchema,
  confirmPublicationSchema,
  paginationSchema,
  idSchema
} from '@postora/shared';
import { validate } from '../middleware/validate.js';
import { previewLimiter, publishLimiter } from '../middleware/rateLimit.js';

const idParamSchema = z.object({ id: idSchema });

/** مسارات المعاينة والنشر. */
export function createPublishRoutes({ publishingService }) {
  const router = Router();

  /**
   * POST /api/preview
   * يعيد مخرجات المحرك المعتمدة من الخادم — تستخدمها الواجهة للتحقق من تطابق معاينتها.
   */
  router.post('/preview', previewLimiter, validate(previewSchema), async (req, res, next) => {
    try {
      const result = publishingService.preview((req.validated?.body ?? req.body).contentMarkdown);
      res.json({ ok: true, data: result });
    } catch (error) {
      next(error);
    }
  });

  /**
   * POST /api/publications — نشر مباشر.
   * الخطوات: تحقق ملكية → تحويل → إنشاء طلب → فحص حي → إرسال.
   */
  router.post('/publications', publishLimiter, validate(publishSchema), async (req, res, next) => {
    try {
      const { publication, preview } = await publishingService.preparePublication({
        user: req.user,
        channelId: (req.validated?.body ?? req.body).channelId,
        contentMarkdown: (req.validated?.body ?? req.body).contentMarkdown,
        draftId: (req.validated?.body ?? req.body).draftId || null,
        source: 'miniapp',
        allowDuplicate: (req.validated?.body ?? req.body).allowDuplicate,
        idempotencyKey: (req.validated?.body ?? req.body).idempotencyKey
      });

      const result = await publishingService.executePublication({
        user: req.user,
        publicationId: publication.id,
        contentMarkdown: (req.validated?.body ?? req.body).contentMarkdown
      });

      res.status(201).json({
        ok: true,
        data: {
          publication: result.publication,
          messageIds: result.messageIds,
          preview
        }
      });
    } catch (error) {
      next(error);
    }
  });

  /** تأكيد نشر طلب معلّق (يُستخدم إن فصلنا المعاينة عن النشر). */
  router.post(
    '/publications/:id/confirm',
    publishLimiter,
    validate(idParamSchema, 'params'),
    validate(confirmPublicationSchema),
    async (req, res, next) => {
      try {
        const result = await publishingService.executePublication({
          user: req.user,
          publicationId: req.params.id,
          contentMarkdown: (req.validated?.body ?? req.body).contentMarkdown
        });
        res.json({ ok: true, data: result });
      } catch (error) {
        next(error);
      }
    }
  );

  router.post('/publications/:id/cancel', validate(idParamSchema, 'params'), async (req, res, next) => {
    try {
      const publication = await publishingService.cancel(req.params.id, req.user.id);
      res.json({ ok: true, data: { publication } });
    } catch (error) {
      next(error);
    }
  });

  router.get('/publications', validate(paginationSchema, 'query'), async (req, res, next) => {
    try {
      const publications = await publishingService.list(req.user.id, req.validated.query);
      res.json({ ok: true, data: { publications } });
    } catch (error) {
      next(error);
    }
  });

  router.get('/publications/:id', validate(idParamSchema, 'params'), async (req, res, next) => {
    try {
      const publication = await publishingService.get(req.user.id, req.params.id);
      res.json({ ok: true, data: { publication } });
    } catch (error) {
      next(error);
    }
  });

  return router;
}
