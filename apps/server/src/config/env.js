import { config as loadDotenv } from 'dotenv';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { z } from 'zod';

/**
 * تحميل .env من جذر المستودع (وليس من مجلد التشغيل).
 * السبب: الخادم قد يُشغَّل من apps/server أو من الجذر — نريد نفس النتيجة.
 */
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = path.resolve(__dirname, '..', '..', '..', '..');

loadDotenv({
  path: [
    path.join(PROJECT_ROOT, '.env'),
    path.join(PROJECT_ROOT, 'apps', 'server', '.env'),
    path.join(process.cwd(), '.env')
  ],
  quiet: true
});

/**
 * تحميل والتحقق من متغيرات البيئة.
 * المبدأ: لا يُقلع الخادم ببيئة ناقصة أو غير آمنة.
 * ملاحظة أمنية: لا نطبع أي قيمة سرية هنا أبدًا — فقط أسماء الحقول الناقصة.
 */

const int = (min, max, def) =>
  z
    .string()
    .optional()
    .transform((v) => (v === undefined || v === '' ? def : Number(v)))
    .refine((n) => Number.isInteger(n) && n >= min && n <= max, {
      message: `must be an integer between ${min} and ${max}`
    });

const schema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: int(1, 65535, 3000),

  BOT_TOKEN: z.string().min(10, 'BOT_TOKEN is required'),
  BOT_USERNAME: z.string().min(3).default('Postora_1bot'),
  BOT_MODE: z.enum(['polling', 'webhook']).default('polling'),
  // RENDER_EXTERNAL_URL توفّره منصة Render تلقائيًا (https://<service>.onrender.com)
  RENDER_EXTERNAL_URL: z.string().url().optional().or(z.literal('')),
  WEBHOOK_URL: z.string().url().optional().or(z.literal('')),
  WEBHOOK_SECRET: z.string().min(8).optional().or(z.literal('')),

  DATABASE_URL: z.string().min(1, 'DATABASE_URL is required'),
  DB_POOL_MAX: int(1, 100, 10),

  JWT_SECRET: z.string().min(32, 'JWT_SECRET must be at least 32 characters'),
  JWT_TTL_SECONDS: int(60, 604800, 7200),
  INIT_DATA_MAX_AGE_SECONDS: int(60, 604800, 86400),

  CORS_ORIGINS: z.string().optional().default('http://localhost:5173'),
  MINIAPP_URL: z.string().optional().default(''),

  MAX_UPLOAD_BYTES: int(1024, 20 * 1024 * 1024, 262144),
  MAX_CONTENT_CHARS: int(1000, 1000000, 100000),
  MAX_PUBLISH_MESSAGES: int(1, 200, 40),
  TELEGRAM_GLOBAL_PER_SECOND: int(1, 100, 25),
  TELEGRAM_PER_CHAT_PER_MINUTE: int(1, 200, 18),

  LOG_LEVEL: z
    .enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent'])
    .default('info'),

  // للتطوير/الاختبار فقط: توجيه Bot API إلى خادم وهمي
  TELEGRAM_API_BASE_URL: z.string().optional().default('')
});

let cached = null;

/**
 * @returns {{config: object, raw: object}}
 */
export function loadEnv() {
  if (cached) return cached;

  const parsed = schema.safeParse(process.env);

  if (!parsed.success) {
    const issues = parsed.error.issues
      .map((issue) => `  - ${issue.path.join('.')}: ${issue.message}`)
      .join('\n');
    // لا نطبع القيم — فقط أسماء الحقول والمشكلة
    throw new Error(`إعدادات البيئة غير صالحة:\n${issues}\nراجع .env.example`);
  }

  const env = parsed.data;
  const explicitWebhookUrl = env.WEBHOOK_URL; // نحفظه قبل أي تعديل (env هو نفس كائن parsed.data)

  // اكتشاف تلقائي لرابط الـ webhook على منصات الاستضافة السحابية.
  // السبب: المستخدم لا يعرف رابط الخدمة قبل أول نشر، فلا نُجبره على تخمينه.
  if (!env.WEBHOOK_URL && env.RENDER_EXTERNAL_URL) {
    env.WEBHOOK_URL = `${env.RENDER_EXTERNAL_URL.replace(/\/$/, '')}/telegram/webhook`;
  }

  if (env.BOT_MODE === 'webhook') {
    if (!env.WEBHOOK_URL || !/^https:\/\//.test(env.WEBHOOK_URL)) {
      throw new Error('WEBHOOK_URL must be an https URL when BOT_MODE=webhook');
    }
    if (!env.WEBHOOK_SECRET) {
      throw new Error('WEBHOOK_SECRET is required when BOT_MODE=webhook');
    }
  }

  if (env.NODE_ENV === 'production' && env.JWT_SECRET.includes('CHANGE_ME')) {
    throw new Error('JWT_SECRET contains a placeholder value — set a real secret for production');
  }

  const config = {
    nodeEnv: env.NODE_ENV,
    isProduction: env.NODE_ENV === 'production',
    isTest: env.NODE_ENV === 'test',
    port: env.PORT,

    bot: {
      token: env.BOT_TOKEN,
      username: env.BOT_USERNAME,
      mode: env.BOT_MODE,
      webhookUrl: env.WEBHOOK_URL || null,
      webhookAutoDetected: !explicitWebhookUrl && Boolean(env.WEBHOOK_URL),
      webhookSecret: env.WEBHOOK_SECRET || null,
      apiBaseUrl: env.TELEGRAM_API_BASE_URL || 'https://api.telegram.org'
    },

    db: {
      url: env.DATABASE_URL,
      poolMax: env.DB_POOL_MAX
    },

    auth: {
      jwtSecret: env.JWT_SECRET,
      jwtTtlSeconds: env.JWT_TTL_SECONDS,
      initDataMaxAgeSeconds: env.INIT_DATA_MAX_AGE_SECONDS
    },

    corsOrigins: env.CORS_ORIGINS.split(',')
      .map((o) => o.trim())
      .filter(Boolean),
    miniappUrl: env.MINIAPP_URL || null,

    limits: {
      maxUploadBytes: env.MAX_UPLOAD_BYTES,
      maxContentChars: env.MAX_CONTENT_CHARS,
      maxPublishMessages: env.MAX_PUBLISH_MESSAGES
    },

    telegramLimits: {
      globalPerSecond: env.TELEGRAM_GLOBAL_PER_SECOND,
      perChatPerMinute: env.TELEGRAM_PER_CHAT_PER_MINUTE
    },

    logLevel: env.LOG_LEVEL
  };

  cached = { config, raw: env };
  return cached;
}

/** للاختبارات: تصفير الكاش بعد تغيير process.env. */
export function resetEnvCache() {
  cached = null;
}
