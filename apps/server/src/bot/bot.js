import { Telegraf } from 'telegraf';
import { ensureUser } from './middleware/ensureUser.js';
import { errorBoundary } from './middleware/errorBoundary.js';
import { botRateLimit } from './middleware/rateLimit.js';
import { registerStartCommand } from './commands/start.js';
import { registerHelpCommand } from './commands/help.js';
import { registerChannelsCommand } from './commands/channels.js';
import { registerMiscCommands } from './commands/misc.js';
import { registerPreviewFlow } from './flows/previewFlow.js';
import { registerPublishFlow } from './flows/publishFlow.js';
import { registerGeneralHandlers } from './handlers/index.js';

/**
 * بناء بوت تلجرام وربط المعالجات.
 *
 * ملاحظات:
 *  - المعالجات رقيقة: أي منطق عمل يُستدعى من services/.
 *  - ترتيب middleware: errorBoundary → rateLimit → ensureUser → المعالجات.
 *  - عند الاختبار نمرر apiRoot إلى خادم وهمي (لا اتصال بتلجرام الحقيقي).
 */
export function createBot({ config, logger, gateway, services }) {
  const bot = new Telegraf(config.bot.token, {
    telegram: {
      apiRoot: config.bot.apiBaseUrl
    }
  });

  const deps = {
    config,
    logger,
    gateway,
    ...services,
    bot
  };

  // وسم حالة لكل تحديث (مطلوب لأن ctx.state يُعاد تعيينه بين التحديثات)
  bot.use((ctx, next) => {
    ctx.state.postora = {};
    return next();
  });
  // في وضع الاختبار نطبع تفاصيل الأخطاء الداخلية (بدون أسرار) لتشخيص الفشل
  bot.use(async (ctx, next) => {
    try {
      await next();
    } catch (error) {
      if (config.isTest) {
        console.error('[bot test] handler error:', error?.code || '', error?.message);
      }
      throw error;
    }
  });
  bot.use(errorBoundary(logger));
  bot.use(botRateLimit({ windowMs: 60_000, limit: config.isTest ? 10000 : 25 }));
  bot.use(ensureUser());

  // الأوامر
  registerStartCommand(bot, deps);
  registerHelpCommand(bot, deps);
  registerChannelsCommand(bot, deps);
  registerMiscCommands(bot, deps);

  // التدفقات
  registerPreviewFlow(bot, deps);
  registerPublishFlow(bot, deps);

  // معالجات عامة + التقاط الأخطاء
  registerGeneralHandlers(bot, deps);

  bot.catch((error, ctx) => {
    logger.error(
      { err: { message: error?.message, name: error?.name }, updateType: ctx?.updateType },
      'bot top-level error'
    );
  });

  return {
    bot,
    deps,
    /** تشغيل البوت حسب الوضع (polling للتطوير، webhook للإنتاج). */
    async launch() {
      if (config.bot.mode === 'webhook') {
        await bot.telegram.setWebhook(config.bot.webhookUrl, {
          secret_token: config.bot.webhookSecret,
          drop_pending_updates: false
        });
        logger.info({ mode: 'webhook' }, 'bot webhook configured');
      } else {
        await bot.telegram.deleteWebhook({ drop_pending_updates: false }).catch(() => {});
        // bot.launch تُرجع Promise: بدون await يُصبح رفضها "unhandled rejection" يقتل العملية.
        // لذا ننتظرها ونعيد رفع الخطأ ليعالجه المستدعي برسالة مفهومة.
        await bot.launch({ dropPendingUpdates: false }, () => {
          logger.info({ mode: 'polling' }, 'bot started (polling)');
        });
      }
    },
    async stop() {
      bot.stop('postora shutdown');
    }
  };
}
