import express from 'express';
import helmet from 'helmet';
import pinoHttp from 'pino-http';
import { createApiRouter } from './api/router.js';
import { createErrorHandler, notFoundHandler } from './api/middleware/errorHandler.js';
import { healthCheck } from './db/pool.js';

/**
 * بناء تطبيق Express (بدون listen) — ليتمكن Supertest من اختباره مباشرة.
 *
 * الأمان المطبق هنا:
 *   helmet (رؤوس حماية) + CORS محصور + حد لحجم الجسم + معالج أخطاء موحّد
 *   + عدم كشف تفاصيل داخلية.
 */
export function createApp({ config, logger, services, db = { healthCheck } }) {
  const app = express();

  app.disable('x-powered-by');
  app.set('trust proxy', 1);

  app.use(
    helmet({
      contentSecurityPolicy: false // تُدار CSP من طبقة الاستضافة/الواجهة
    })
  );

  // CORS يدوي ومحصور على أصول معروفة (لا حزم إضافية، لا سلوك ضمني)
  app.use((req, res, next) => {
    const origin = req.headers.origin;
    const allowed = config.corsOrigins;

    if (origin && (allowed.includes(origin) || allowed.includes('*'))) {
      res.setHeader('Access-Control-Allow-Origin', origin);
      res.setHeader('Vary', 'Origin');
      res.setHeader('Access-Control-Allow-Credentials', 'false');
      res.setHeader(
        'Access-Control-Allow-Headers',
        'Content-Type, Authorization, X-Telegram-Init-Data'
      );
      res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PATCH, DELETE, OPTIONS');
      res.setHeader('Access-Control-Max-Age', '600');
    }

    if (req.method === 'OPTIONS') return res.sendStatus(204);
    return next();
  });

  app.use(express.json({ limit: '512kb' }));
  app.use(express.urlencoded({ extended: false, limit: '64kb' }));

  if (!config.isTest) {
    app.use(
      pinoHttp({
        logger,
        autoLogging: {
          ignore: (req) => req.url === '/health'
        },
        customLogLevel: (_req, res, err) =>
          err || res.statusCode >= 500 ? 'error' : res.statusCode >= 400 ? 'warn' : 'info',
        serializers: {
          req: (req) => ({ method: req.method, url: req.url }),
          res: (res) => ({ statusCode: res.statusCode })
        }
      })
    );
  }

  /** GET /health — فحص حياة + حالة قاعدة البيانات. */
  app.get('/health', async (_req, res) => {
    let dbOk = false;
    try {
      dbOk = await db.healthCheck();
    } catch {
      dbOk = false;
    }
    res.status(dbOk ? 200 : 503).json({
      ok: dbOk,
      service: 'postora',
      version: '1.0.0',
      db: dbOk ? 'up' : 'down',
      timestamp: new Date().toISOString()
    });
  });

  app.use('/api', createApiRouter(services));

  app.use(notFoundHandler);
  app.use(createErrorHandler(logger));

  return app;
}
