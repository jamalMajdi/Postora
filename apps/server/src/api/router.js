import { Router } from 'express';
import { createAuthRoutes } from './routes/authRoutes.js';
import { createMeRoutes } from './routes/meRoutes.js';
import { createDraftRoutes } from './routes/draftRoutes.js';
import { createChannelRoutes } from './routes/channelRoutes.js';
import { createPublishRoutes } from './routes/publishRoutes.js';
import { createAuthenticate } from './middleware/authenticate.js';
import { generalLimiter } from './middleware/rateLimit.js';

/**
 * يبني راوتر API كاملًا.
 * كل خدمات منطق العمل تُحقن هنا — لا وصول مباشر لقاعدة البيانات من المسارات.
 */
export function createApiRouter(services) {
  const router = Router();
  const authenticate = createAuthenticate(services.authService);

  router.use(generalLimiter);

  // المصادقة (بعض مساراتها عامة، والبعض يحتاج جلسة)
  router.use('/auth', createAuthRoutes({ authService: services.authService }));

  // كل ما يلي يحتاج جلسة صالحة
  router.use(authenticate);

  router.use('/me', createMeRoutes());
  router.use('/drafts', createDraftRoutes({ draftService: services.draftService }));
  router.use('/channels', createChannelRoutes({ channelService: services.channelService }));

  // مسارات المعاينة والنشر تحت /api
  const publishRoutes = createPublishRoutes({ publishingService: services.publishingService });
  router.use('/', publishRoutes);

  return router;
}
