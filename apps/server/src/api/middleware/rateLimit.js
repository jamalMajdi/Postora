import rateLimit, { ipKeyGenerator } from 'express-rate-limit';
import { AppError } from '../../errors/AppError.js';
import { ErrorCode } from '@postora/shared';

/**
 * حَدّ معدل الطلبات في الذاكرة (قرار D3 في architecture.md).
 * عند التوسع الأفقي يُستبدل بمخزن مشترك (Redis أو جدول rate_limit_hits).
 *
 * المفتاح: معرّف المستخدم إن كان مصادقًا، وإلا عنوان IP.
 */
function keyGenerator(req, res) {
  // مستخدمون مصادقون: المفتاح هو معرّف المستخدم (لا يمكن تجاوزه بتغيير IP).
  // غير مصادقين: ipKeyGenerator يتولى تطبيع عناوين IPv6 (توصية المكتبة).
  if (req.user?.id) return `user:${req.user.id}`;
  return ipKeyGenerator(req.ip, res);
}

function handler(_req, _res, next) {
  next(new AppError(ErrorCode.RATE_LIMITED, { status: 429 }));
}

const common = {
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  keyGenerator,
  handler,
  // في الاختبارات نعطّل الحد تمامًا
  skip: () => process.env.NODE_ENV === 'test'
};

/** مسارات عامة: 120 طلبًا بالدقيقة. */
export const generalLimiter = rateLimit({
  ...common,
  windowMs: 60 * 1000,
  limit: 120
});

/** معاينة/تحويل: 60 في الدقيقة (تحويل Markdown مكلف نسبيًا). */
export const previewLimiter = rateLimit({
  ...common,
  windowMs: 60 * 1000,
  limit: 60
});

/** نشر: 10 في الدقيقة لكل مستخدم. */
export const publishLimiter = rateLimit({
  ...common,
  windowMs: 60 * 1000,
  limit: 10
});

/** مصادقة: 20 في الدقيقة (لتخفيف محاولات إساءة استخدام initData). */
export const authLimiter = rateLimit({
  ...common,
  windowMs: 60 * 1000,
  limit: 20
});
