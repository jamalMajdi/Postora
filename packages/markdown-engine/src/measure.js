import { TELEGRAM_HARD_LIMIT } from './constants.js';

/**
 * قياس الطول كما يفهمه تلجرام: وحدات UTF-16 على النص النهائي (بعد التحويل).
 * "😀".length === 2 في JS — وهذا مطابق لسلوك Telegram Bot API.
 *
 * @param {string} text
 * @returns {number}
 */
export function utf16Length(text) {
  return typeof text === 'string' ? text.length : 0;
}

/**
 * هل يقع الفهرس المطلوب في منتصف زوج بديل (surrogate pair)؟
 * @param {string} text
 * @param {number} index
 */
export function isSplitInsideSurrogatePair(text, index) {
  if (index <= 0 || index >= text.length) return false;
  const prev = text.charCodeAt(index - 1);
  const next = text.charCodeAt(index);
  return prev >= 0xd800 && prev <= 0xdbff && next >= 0xdc00 && next <= 0xdfff;
}

/**
 * يقصّ نصًا إلى أقصى طول مسموح دون كسر محرف.
 * @param {string} text
 * @param {number} max
 * @returns {{head: string, tail: string}}
 */
export function cutAtSafeBoundary(text, max) {
  if (text.length <= max) return { head: text, tail: '' };
  let index = max;
  if (isSplitInsideSurrogatePair(text, index)) index -= 1;
  if (index <= 0) index = 1; // محرف واحد على الأقل
  return { head: text.slice(0, index), tail: text.slice(index) };
}

/**
 * يقيس مجموعة رسائل ويعيد ملخصًا يُعرض للمستخدم في المعاينة.
 * @param {Array<{text: string, entities?: any[]}>} messages
 */
export function measureMessages(messages) {
  const lengths = messages.map((m) => utf16Length(m.text));
  const entityCounts = messages.map((m) => (m.entities ? m.entities.length : 0));
  return {
    messagesCount: messages.length,
    lengths,
    totalChars: lengths.reduce((a, b) => a + b, 0),
    maxLength: lengths.length ? Math.max(...lengths) : 0,
    totalEntities: entityCounts.reduce((a, b) => a + b, 0),
    maxEntities: entityCounts.length ? Math.max(...entityCounts) : 0,
    withinHardLimit: lengths.every((l) => l <= TELEGRAM_HARD_LIMIT)
  };
}
