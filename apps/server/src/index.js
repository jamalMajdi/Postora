import { loadEnv } from './config/env.js';
import { createLogger } from './utils/logger.js';
import { buildServices } from './container.js';
import { createApp } from './app.js';
import { createBot } from './bot/bot.js';
import { healthCheck, closePool } from './db/pool.js';

/**
 * هل التوكن مجرد قيمة مثال من `.env.example` أو فارغ؟
 * نتحقق دون طباعة أي جزء منه.
 */
function isPlaceholderToken(token) {
  const value = String(token ?? '').trim();
  if (!value) return true;
  // قيم .env.example الافتراضية فقط — أي توكن آخر يُجرَّب فعليًا مع تلجرام
  return /^(YOUR_|CHANGE_ME)/i.test(value);
}

/**
 * تشغيل البوت مع رسالة خطأ عربية واضحة بدل انهيار بستاك ترييس.
 * الأكثر شيوعًا: توكن خاطئ أو مُبطَل (401).
 */
async function launchBot(botRunner, logger) {
  try {
    await botRunner.launch();
    logger.info('bot started');
  } catch (error) {
    if (error?.response?.error_code === 401) {
      logger.error(
        'BOT TOKEN REJECTED (401 Unauthorized) — the token in .env is wrong or revoked. ' +
          'Get a fresh one from @BotFather (API Token) and restart. ' +
          'The HTTP API keeps running, but the bot will not respond.'
      );
      return;
    }
    if (error?.response?.error_code === 409) {
      logger.error(
        'BOT CONFLICT (409) — another instance (or a webhook) is already polling this token. ' +
          'Stop the other instance, or call deleteWebhook, then restart.'
      );
      return;
    }
    logger.error({ code: error?.response?.error_code }, `BOT FAILED TO START: ${error?.message}`);
  }
}

/**
 * نقطة تشغيل Postora.
 *
 * الترتيب:
 *  1) تحقق من البيئة (يفشل سريعًا إن كان هناك نقص).
 *  2) تحقق من اتصال قاعدة البيانات.
 *  3) تشغيل HTTP API.
 *  4) تشغيل البوت (polling أو webhook).
 *
 * لا تُطبع أي أسرار في السجلات.
 */
async function main() {
  const { config } = loadEnv();
  const logger = createLogger(config.logLevel);

  logger.info(
    {
      node: process.version,
      env: config.nodeEnv,
      botMode: config.bot.mode,
      port: config.port
    },
    'starting postora'
  );

  // 2) قاعدة البيانات
  const dbOk = await healthCheck().catch(() => false);
  if (!dbOk) {
    logger.fatal('database is not reachable — check DATABASE_URL and that PostgreSQL is running');
    process.exit(1);
  }
  logger.info('database connected');

  const services = buildServices({ config, logger });

  // 3) HTTP
  const app = createApp({ config, logger, services });
  const server = app.listen(config.port, '0.0.0.0', () => {
    logger.info({ port: config.port }, 'http server listening');
  });

  // 4) البوت
  let botRunner = null;
  const botConfigured = Boolean(config.bot.token) && !isPlaceholderToken(config.bot.token);

  if (!botConfigured) {
    // قرار مقصود: البوت غير مفعّل عند غياب توكن حقيقي، لكن واجهة الـ API تبقى تعمل.
    // هذا يسمح بتشغيل المشروع فور تنزيله واختباره قبل إنشاء توكن.
    logger.warn(
      'BOT DISABLED — BOT_TOKEN is missing or a placeholder. The HTTP API works; ' +
        'set a real token from @BotFather in .env and restart to enable the bot.'
    );
  } else if (config.bot.mode === 'webhook') {
    botRunner = createBot({ config, logger, gateway: services.gateway, services });
    app.use(
      '/telegram/webhook',
      (req, res, next) => {
        const secret = req.headers['x-telegram-bot-api-secret-token'];
        if (!config.bot.webhookSecret || secret !== config.bot.webhookSecret) {
          logger.warn({ ip: req.ip }, 'rejected webhook with invalid secret');
          return res.sendStatus(401);
        }
        return next();
      },
      botRunner.bot.webhookCallback('/telegram/webhook')
    );
    await launchBot(botRunner, logger);
  } else {
    botRunner = createBot({ config, logger, gateway: services.gateway, services });
    await launchBot(botRunner, logger);
  }

  // إغلاق نظيف
  const shutdown = async (signal) => {
    logger.info({ signal }, 'shutting down');
    try {
      await botRunner?.bot?.stop(signal);
    } catch {
      // تجاهل
    }
    server.close(async () => {
      await closePool().catch(() => {});
      process.exit(0);
    });
    setTimeout(() => process.exit(1), 10_000).unref();
  };

  process.once('SIGINT', () => shutdown('SIGINT'));
  process.once('SIGTERM', () => shutdown('SIGTERM'));
}

main().catch((error) => {
  // لا نطبع أي قيمة بيئية — فقط الرسالة
  console.error('[postora] fatal startup error:', error?.message);
  process.exit(1);
});
