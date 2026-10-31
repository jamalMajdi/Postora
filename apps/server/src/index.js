
import { loadEnv } from './config/env.js';
import { createLogger } from './utils/logger.js';
import { buildServices } from './container.js';
import { createApp } from './app.js';
import { createBot } from './bot/bot.js';
import { healthCheck, closePool } from './db/pool.js';

/**
 * التحقق من أن التوكن ليس قيمة تجريبية.
 */
function isPlaceholderToken(token) {
  const value = String(token ?? '').trim();

  if (!value) return true;

  return /^(YOUR_|CHANGE_ME)/i.test(value);
}

/**
 * تشغيل البوت ومعالجة أخطاء Telegram.
 */
async function launchBot(botRunner, logger) {
  try {
    await botRunner.launch();
    logger.info('bot started');
  } catch (error) {
    if (error?.response?.error_code === 401) {
      logger.error(
        'BOT TOKEN REJECTED (401 Unauthorized) — check BOT_TOKEN.'
      );
      return;
    }

    if (error?.response?.error_code === 409) {
      logger.error(
        'BOT CONFLICT (409) — another instance or webhook conflict.'
      );
      return;
    }

    logger.error(
      {
        code: error?.response?.error_code
      },
      `BOT FAILED TO START: ${error?.message}`
    );
  }
}

/**
 * نقطة تشغيل Postora.
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

  // 1) التحقق من قاعدة البيانات
  const dbOk = await healthCheck().catch(() => false);

  if (!dbOk) {
    logger.fatal(
      'database is not reachable — check DATABASE_URL'
    );

    process.exit(1);
  }

  logger.info('database connected');

  // 2) تجهيز الخدمات
  const services = buildServices({ config, logger });

  // 3) تجهيز البوت قبل إنشاء تطبيق Express
  let botRunner = null;

  const botConfigured =
    Boolean(config.bot.token) &&
    !isPlaceholderToken(config.bot.token);

  if (botConfigured) {
    botRunner = createBot({
      config,
      logger,
      gateway: services.gateway,
      services
    });
  }

  // 4) إنشاء تطبيق Express مع تمرير البوت
  const app = createApp({
    config,
    logger,
    services,
    botRunner
  });

  // 5) تشغيل خادم HTTP
  const server = app.listen(
    config.port,
    '0.0.0.0',
    () => {
      logger.info(
        { port: config.port },
        'http server listening'
      );
    }
  );

  // انتظار جاهزية الخادم قبل تسجيل Webhook في Telegram
  await new Promise((resolve, reject) => {
    server.once('listening', resolve);
    server.once('error', reject);
  });

  // 6) تشغيل البوت
  if (!botConfigured) {
    logger.warn(
      'BOT DISABLED — BOT_TOKEN is missing or a placeholder. HTTP API remains available.'
    );
  } else {
    await launchBot(botRunner, logger);
  }

  // 7) إغلاق نظيف
  const shutdown = async (signal) => {
    logger.info({ signal }, 'shutting down');

    try {
      await botRunner?.bot?.stop(signal);
    } catch {
      // تجاهل أخطاء إيقاف البوت
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
  console.error(
    '[postora] fatal startup error:',
    error?.message
  );

  process.exit(1);
});
