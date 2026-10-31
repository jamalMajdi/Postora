import { createHash, randomBytes, timingSafeEqual } from 'node:crypto';

/**
 * أدوات تشفير مساعدة. لا تُسجَّل أي قيمة ناتجة عن هذه الدوال.
 */

/** بصمة SHA-256 لمحتوى (تُستخدم لكشف التكرار والمقارنة فقط). */
export function sha256Hex(value) {
  return createHash('sha256').update(String(value), 'utf8').digest('hex');
}

/**
 * بصمة محتوى Markdown "متطابقة" رغم اختلافات الهوامش.
 * تطبيع: توحيد أسطر جديدة، إزالة المسافات الطرفية في كل سطر، وتقليص الأسطر الفارغة.
 * @param {string} markdown
 */
export function contentFingerprint(markdown) {
  const normalized = String(markdown || '')
    .replace(/\r\n?/g, '\n')
    .split('\n')
    .map((line) => line.replace(/[ \t]+$/, '').replace(/^[ \t]+/, (m) => m.replace(/\t/g, '  ')))
    .join('\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
  return sha256Hex(normalized);
}

/** سلسلة عشوائية آمنة للاستخدام كمفتاح idempotency. */
export function randomKey(bytes = 24) {
  return randomBytes(bytes).toString('base64url');
}

/** مقارنة آمنة زمنيًا لسلسلتين. */
export function safeEqual(a, b) {
  const bufA = Buffer.from(String(a));
  const bufB = Buffer.from(String(b));
  if (bufA.length !== bufB.length) return false;
  return timingSafeEqual(bufA, bufB);
}
