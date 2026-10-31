import { createHmac, timingSafeEqual } from 'node:crypto';
import { AppError } from '../errors/AppError.js';
import { ErrorCode } from '@postora/shared';

/**
 * التحقق من Telegram WebApp initData حسب الآلية الرسمية:
 *   secret_key = HMAC_SHA256(bot_token, key = "WebAppData")
 *   hash       = HMAC_SHA256(secret_key, data_check_string)
 * حيث data_check_string = كل الحقول (عدا hash) مرتبة أبجديًا بصيغة key=value مفصولة بـ \n.
 *
 * مراجع: https://core.telegram.org/bots/webapps#validating-data-received-via-the-mini-app
 *
 * ملاحظات أمان:
 *  - التحقق يتم على الخادم فقط. المتصفح لا يقرر هوية أحد.
 *  - نرفض auth_date الأقدم من الحد المسموح (منع إعادة الاستخدام).
 *  - نقارن التوقيع زمنيًا بأمان (timingSafeEqual).
 */

/**
 * @param {string} initData السلسلة الخام من window.Telegram.WebApp.initData
 * @param {object} options
 * @param {string} options.botToken
 * @param {number} [options.maxAgeSeconds]
 * @returns {{user: {id: number|string, username?: string, first_name?: string, last_name?: string, language_code?: string}, authDate: number, raw: object}}
 */
export function validateInitData(initData, options) {
  const { botToken, maxAgeSeconds = 86400, now = () => Math.floor(Date.now() / 1000) } = options;

  if (typeof initData !== 'string' || initData.trim() === '') {
    throw new AppError(ErrorCode.AUTH_MISSING_INIT_DATA);
  }

  let params;
  try {
    params = new URLSearchParams(initData);
  } catch {
    throw new AppError(ErrorCode.AUTH_INVALID_INIT_DATA);
  }

  const hash = params.get('hash');
  if (!hash) {
    throw new AppError(ErrorCode.AUTH_INVALID_INIT_DATA);
  }

  // بناء data_check_string من كل الحقول عدا hash
  const pairs = [];
  for (const [key, value] of [...params.entries()]) {
    if (key === 'hash' || key === 'signature') continue;
    pairs.push([key, value]);
  }
  pairs.sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0));
  const dataCheckString = pairs.map(([key, value]) => `${key}=${value}`).join('\n');

  const secretKey = createHmac('sha256', 'WebAppData').update(botToken).digest();
  const computed = createHmac('sha256', secretKey).update(dataCheckString).digest('hex');

  if (!safeCompareHex(computed, hash)) {
    throw new AppError(ErrorCode.AUTH_INVALID_INIT_DATA);
  }

  // فحص العمر
  const authDate = Number(params.get('auth_date'));
  if (!Number.isFinite(authDate) || authDate <= 0) {
    throw new AppError(ErrorCode.AUTH_INVALID_INIT_DATA);
  }
  const ageSeconds = now() - authDate;
  if (ageSeconds > maxAgeSeconds) {
    throw new AppError(ErrorCode.AUTH_EXPIRED_INIT_DATA, {
      details: { ageSeconds }
    });
  }
  // سماح بسيط لانحراف الساعة (£ 5 دقائق) لكن لا نقبل تواريخ من المستقبل البعيد
  if (ageSeconds < -300) {
    throw new AppError(ErrorCode.AUTH_INVALID_INIT_DATA);
  }

  const userJson = params.get('user');
  if (!userJson) {
    throw new AppError(ErrorCode.AUTH_INVALID_INIT_DATA);
  }

  let user;
  try {
    user = JSON.parse(userJson);
  } catch {
    throw new AppError(ErrorCode.AUTH_INVALID_INIT_DATA);
  }

  if (!user || user.id === undefined || user.id === null) {
    throw new AppError(ErrorCode.AUTH_INVALID_INIT_DATA);
  }

  return {
    user: {
      id: String(user.id),
      username: user.username,
      first_name: user.first_name,
      last_name: user.last_name,
      language_code: user.language_code,
      is_premium: Boolean(user.is_premium)
    },
    authDate,
    raw: Object.fromEntries(params.entries())
  };
}

function safeCompareHex(a, b) {
  const bufA = Buffer.from(String(a), 'hex');
  const bufB = Buffer.from(String(b), 'hex');
  if (bufA.length === 0 || bufA.length !== bufB.length) return false;
  return timingSafeEqual(bufA, bufB);
}

/**
 * أداة تطوير/اختبار: تبني initData موقّعة صحيحة.
 * تُستخدم فقط في الاختبارات وتشغيل Mini App محليًا خارج تلجرام.
 * لا تُستخدم أبدًا في أي مسار إنتاجي — والاستدعاء الوحيد لها في الكود من سكربت/اختبار.
 *
 * @param {object} user
 * @param {string} botToken
 * @param {{authDate?: number, extra?: Record<string,string>}} [options]
 */
export function buildInitDataForTests(user, botToken, options = {}) {
  const authDate = options.authDate ?? Math.floor(Date.now() / 1000);
  const params = new URLSearchParams();
  params.set('auth_date', String(authDate));
  params.set('query_id', options.queryId ?? `test-${authDate}`);
  params.set('user', JSON.stringify(user));
  for (const [key, value] of Object.entries(options.extra || {})) {
    params.set(key, value);
  }

  const pairs = [...params.entries()].sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0));
  const dataCheckString = pairs.map(([k, v]) => `${k}=${v}`).join('\n');
  const secretKey = createHmac('sha256', 'WebAppData').update(botToken).digest();
  const hash = createHmac('sha256', secretKey).update(dataCheckString).digest('hex');

  params.set('hash', hash);
  return params.toString();
}
