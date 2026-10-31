import { Router } from 'express';
import { draftCreateSchema, draftUpdateSchema, paginationSchema, idSchema } from '@postora/shared';
import { validate } from '../middleware/validate.js';
import { z } from 'zod';

const listQuerySchema = paginationSchema.extend({
  status: z.enum(['draft', 'archived']).optional()
});

const idParamSchema = z.object({ id: idSchema });

/** مسارات المسودات — كل استعلام مقيّد بـ user.id من الجلسة. */
export function createDraftRoutes({ draftService }) {
  const router = Router();

  router.get('/', validate(listQuerySchema, 'query'), async (req, res, next) => {
    try {
      const drafts = await draftService.list(req.user, req.validated.query);
      res.json({ ok: true, data: { drafts } });
    } catch (error) {
      next(error);
    }
  });

  router.post('/', validate(draftCreateSchema), async (req, res, next) => {
    try {
      const draft = await draftService.create({ user: req.user, ...(req.validated?.body ?? req.body) });
      res.status(201).json({ ok: true, data: { draft } });
    } catch (error) {
      next(error);
    }
  });

  router.get('/:id', validate(idParamSchema, 'params'), async (req, res, next) => {
    try {
      const draft = await draftService.get(req.user, req.params.id);
      res.json({ ok: true, data: { draft } });
    } catch (error) {
      next(error);
    }
  });

  router.patch(
    '/:id',
    validate(idParamSchema, 'params'),
    validate(draftUpdateSchema),
    async (req, res, next) => {
      try {
        const draft = await draftService.update(req.user, req.params.id, req.validated?.body ?? req.body);
        res.json({ ok: true, data: { draft } });
      } catch (error) {
        next(error);
      }
    }
  );

  router.delete('/:id', validate(idParamSchema, 'params'), async (req, res, next) => {
    try {
      const result = await draftService.remove(req.user, req.params.id);
      res.json({ ok: true, data: result });
    } catch (error) {
      next(error);
    }
  });

  return router;
}
