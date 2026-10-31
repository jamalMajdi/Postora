/**
 * تهيئة كل مجموعة اختبارات: متغيرات بيئة اختبار آمنة (لا أسرار حقيقية).
 * تُنفَّذ قبل تحميل أي وحدة تستخدم loadEnv.
 */
process.env.NODE_ENV = 'test';
process.env.BOT_TOKEN = '123456:TEST_TOKEN_NOT_REAL_FOR_TESTS_ONLY';
process.env.BOT_USERNAME = 'Postora_1bot';
process.env.BOT_MODE = 'polling';
process.env.DATABASE_URL =
  process.env.TEST_DATABASE_URL ||
  'postgresql://postora:postora_dev_pw@127.0.0.1:5432/postora_test';
process.env.JWT_SECRET = 'test_secret_for_postora_suite_at_least_32_chars_long_0001';
process.env.JWT_TTL_SECONDS = '7200';
process.env.INIT_DATA_MAX_AGE_SECONDS = '86400';
process.env.CORS_ORIGINS = 'http://localhost:5173';
process.env.LOG_LEVEL = 'silent';
process.env.MAX_UPLOAD_BYTES = '262144';
process.env.MAX_CONTENT_CHARS = '100000';
process.env.MAX_PUBLISH_MESSAGES = '40';
// حدود البوابة مرتفعة في الاختبارات حتى لا تتحول إلى انتظار حقيقي
process.env.TELEGRAM_GLOBAL_PER_SECOND = '100';
process.env.TELEGRAM_PER_CHAT_PER_MINUTE = '200';
