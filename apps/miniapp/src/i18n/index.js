import ar from './ar.js';
import en from './en.js';

/**
 * i18n بسيط بلا مكتبات خارجية:
 *  - ترجمات مسطحة عبر مسار مثل 'editor.publishNow'
 *  - دعم RTL/LTR تلقائي
 *  - لا تعتمد على أي مورد شبكي (تعمل في بيئة بلا إنترنت)
 */
export const translations = { ar, en };

export const SUPPORTED_LOCALES = ['ar', 'en'];

export const DIRECTION = { ar: 'rtl', en: 'ltr' };

/** يقرأ قيمة عبر مسار نقطي مع دعم الاستبدال. */
export function translate(locale, path, replacements = {}) {
  const dict = translations[locale] || translations.ar;
  const value = path.split('.').reduce((acc, key) => (acc ? acc[key] : undefined), dict);

  if (typeof value !== 'string') {
    // fallback إلى العربية ثم إلى المسار نفسه
    const fallback = path
      .split('.')
      .reduce((acc, key) => (acc ? acc[key] : undefined), translations.ar);
    if (typeof fallback !== 'string') return path;
    return applyReplacements(fallback, replacements);
  }
  return applyReplacements(value, replacements);
}

function applyReplacements(text, replacements) {
  return Object.entries(replacements).reduce(
    (acc, [key, value]) => acc.replaceAll(`%${key}%`, String(value)),
    text
  );
}

/** يحدد اللغة الابتدائية: من تلجرام إن توفرت، وإلا العربية. */
export function detectLocale(telegramLanguageCode) {
  if (telegramLanguageCode && telegramLanguageCode.startsWith('en')) return 'en';
  return 'ar';
}

/* ==================================================================== */
/* جمع الأعداد — العربية تحتاج قواعد خاصة، والإنجليزية مفرد/جمع          */
/* ==================================================================== */

/**
 * يعيد الصيغة الصحيحة للوحدة حسب العدد واللغة.
 *
 * العربية:
 *   0        → "لا رسائل"
 *   1        → "رسالة واحدة"
 *   2        → "رسالتان"
 *   3–10     → "N رسائل"
 *   11+      → "N رسالة"
 * الإنجليزية: 1 → "1 message" · غيرها → "N messages"
 *
 * @param {'ar'|'en'} locale
 * @param {number} count
 * @param {'messages'|'chars'|'channels'|'drafts'} unit
 * @returns {string}
 */
export function formatCount(locale, count, unit) {
  const n = Number.isFinite(count) ? count : 0;
  const dict = UNIT_FORMS[unit] || UNIT_FORMS.messages;

  if (locale === 'en') {
    return `${n} ${n === 1 ? dict.en.one : dict.en.other}`;
  }

  if (n === 0) return dict.ar.zero;
  if (n === 1) return dict.ar.one;
  if (n === 2) return dict.ar.two;
  const mod = n % 100;
  if (mod >= 3 && mod <= 10) return `${n} ${dict.ar.few}`;
  return `${n} ${dict.ar.many}`;
}

const UNIT_FORMS = {
  messages: {
    ar: { zero: 'لا رسائل', one: 'رسالة واحدة', two: 'رسالتان', few: 'رسائل', many: 'رسالة' },
    en: { one: 'message', other: 'messages' }
  },
  chars: {
    ar: { zero: 'لا محارف', one: 'محرف واحد', two: 'محرفان', few: 'محارف', many: 'محرفًا' },
    en: { one: 'character', other: 'characters' }
  },
  channels: {
    ar: { zero: 'لا قنوات', one: 'قناة واحدة', two: 'قناتان', few: 'قنوات', many: 'قناة' },
    en: { one: 'channel', other: 'channels' }
  },
  drafts: {
    ar: { zero: 'لا مسودات', one: 'مسودة واحدة', two: 'مسودتان', few: 'مسودات', many: 'مسودة' },
    en: { one: 'draft', other: 'drafts' }
  }
};
