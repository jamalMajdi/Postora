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
