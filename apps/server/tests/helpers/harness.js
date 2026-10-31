import { createFakeTelegram } from './fakeTelegram.js';
import { buildInitDataForTests } from '../../src/telegram/initDataValidator.js';
import { resetDatabase } from './testDb.js';

export const TEST_BOT_TOKEN = '123456:TEST_TOKEN_NOT_REAL_FOR_TESTS_ONLY';

/**
 * Harness لاختبارات التكامل والوحدات:
 *  - خادم تلجرام وهمي على منفذ عشوائي (لا اتصال بتلجرام الحقيقي).
 *  - إعادة بناء قاعدة بيانات الاختبار من ملف الترحيل نفسه.
 *  - خدمات + تطبيق Express جاهز لـ Supertest.
 */
export async function createHarness({ resetDb = true } = {}) {
  const fake = createFakeTelegram({ token: TEST_BOT_TOKEN });
  const apiBaseUrl = await fake.listen(0);

  // نضبط البيئة صراحةً لئلا يؤثر .env المحلي على الاختبارات
  process.env.NODE_ENV = 'test';
  process.env.BOT_TOKEN = TEST_BOT_TOKEN;
  process.env.DATABASE_URL =
    process.env.TEST_DATABASE_URL ||
    'postgresql://postora:postora_dev_pw@127.0.0.1:5432/postora_test';
  process.env.JWT_SECRET =
    process.env.JWT_SECRET && process.env.JWT_SECRET.length >= 32
      ? process.env.JWT_SECRET
      : 'test_secret_for_postora_suite_at_least_32_chars_long_0001';
  process.env.TELEGRAM_API_BASE_URL = apiBaseUrl;

  const { loadEnv, resetEnvCache } = await import('../../src/config/env.js');
  resetEnvCache();
  const { config } = loadEnv();

  const { buildServices } = await import('../../src/container.js');
  const { createLogger } = await import('../../src/utils/logger.js');
  const { createApp } = await import('../../src/app.js');
  const { closePool } = await import('../../src/db/pool.js');

  const logger = createLogger('silent');
  const services = buildServices({ config, logger });
  // توجيه البوابة إلى الخادم الوهمي
  services.gateway.apiBaseUrl = apiBaseUrl;

  const app = createApp({
    config,
    logger,
    services,
    db: { healthCheck: async () => true }
  });

  if (resetDb) await resetDatabase();

  return {
    fake,
    config,
    services,
    app,
    logger,
    closePool,
    apiBaseUrl,
    makeInitData: (user, options = {}) => buildInitDataForTests(user, TEST_BOT_TOKEN, options),
    async close() {
      await fake.close();
      await closePool().catch(() => {});
    }
  };
}

/** مستخدم تلجرام افتراضي للاختبارات. */
export const testUser = {
  id: 111222333,
  first_name: 'مستخدم',
  last_name: 'اختباري',
  username: 'test_user',
  language_code: 'ar'
};

export const secondUser = {
  id: 444555666,
  first_name: 'مستخدم',
  last_name: 'ثاني',
  username: 'second_user',
  language_code: 'ar'
};
