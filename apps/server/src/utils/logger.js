import pino from 'pino';

/**
 * Logger موحّد مع تنقية (redaction) لأي مفتاح أو بيانات اعتماد.
 * قاعدة صارمة: لا تُسجَّل قيم BOT_TOKEN / initData / JWT / hash ولا محتوى المستخدم.
 */
const REDACT_PATHS = [
  'req.headers.authorization',
  'req.headers["x-telegram-init-data"]',
  'req.headers.cookie',
  'res.headers["set-cookie"]',
  '*.token',
  '*.botToken',
  '*.initData',
  '*.password',
  '*.secret',
  '*.jwt'
];

export function createLogger(level = 'info', options = {}) {
  return pino({
    level,
    redact: { paths: REDACT_PATHS, censor: '[REDACTED]' },
    base: undefined,
    timestamp: pino.stdTimeFunctions.isoTime,
    ...options
  });
}

export const logger = createLogger(process.env.LOG_LEVEL || 'info');
