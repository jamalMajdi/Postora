import { ALLOWED_LINK_PROTOCOLS } from './constants.js';

/**
 * هروب HTML لتلجرام.
 * تلجرام يفك HTML فقط لثلاثة محارف في النص: & < >
 * (لا نحتاج هروب " أو ' داخل النص، لكننا نهربها في قيم الخصائص).
 */
export function escapeHtml(text) {
  return String(text).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

/** هروب قيمة خاصية داخل وسم HTML. */
export function escapeHtmlAttribute(text) {
  return escapeHtml(text).replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

/**
 * يعيد تطبيع رابط ويقرر إن كان آمنًا للاستخدام ككيان رابط.
 * @param {string} raw
 * @returns {string|null} الرابط المطبع أو null إن كان مخططه غير مسموح
 */
export function sanitizeUrl(raw) {
  if (typeof raw !== 'string') return null;
  const trimmed = raw.trim();
  if (!trimmed) return null;

  // روابط نسبية أو بدون مخطط: نسمح فقط بما يبدأ بمخطط معروف.
  let parsed;
  try {
    parsed = new URL(trimmed);
  } catch {
    return null;
  }
  if (!ALLOWED_LINK_PROTOCOLS.includes(parsed.protocol)) return null;
  return parsed.href;
}
