/**
 * تحذيرات التنسيقات غير المدعومة في تلجرام.
 * المحرك لا يحذف شيئًا صامتًا: كل تحويل جرت عليه "تسوية" ينتج تحذيرًا يُعرض للمستخدم.
 */
export const WarningCode = Object.freeze({
  HEADING_AS_BOLD: 'HEADING_AS_BOLD',
  LIST_AS_TEXT: 'LIST_AS_TEXT',
  NESTED_LIST_AS_TEXT: 'NESTED_LIST_AS_TEXT',
  TABLE_AS_MONOSPACE: 'TABLE_AS_MONOSPACE',
  IMAGE_AS_LINK: 'IMAGE_AS_LINK',
  HR_AS_TEXT: 'HR_AS_TEXT',
  RAW_HTML_SHOWN_AS_TEXT: 'RAW_HTML_SHOWN_AS_TEXT',
  UNSAFE_LINK_AS_TEXT: 'UNSAFE_LINK_AS_TEXT',
  CODE_BLOCK_SPLIT: 'CODE_BLOCK_SPLIT',
  MESSAGE_SPLIT: 'MESSAGE_SPLIT',
  UNSUPPORTED_INLINE_AS_TEXT: 'UNSUPPORTED_INLINE_AS_TEXT'
});

const MESSAGES = {
  [WarningCode.HEADING_AS_BOLD]: {
    ar: 'العناوين غير مدعومة في تلجرام، فستظهر كسطر عريض.',
    en: 'Telegram does not support headings; they are rendered as a bold line.'
  },
  [WarningCode.LIST_AS_TEXT]: {
    ar: 'تلجرام لا يدعم القوائم، فستظهر برموز • أو أرقام.',
    en: 'Telegram does not support lists; items are rendered with bullets or numbers.'
  },
  [WarningCode.NESTED_LIST_AS_TEXT]: {
    ar: 'القوائم المتداخلة تُعرض بمسافات بادئة.',
    en: 'Nested lists are rendered with leading indentation.'
  },
  [WarningCode.TABLE_AS_MONOSPACE]: {
    ar: 'الجداول غير مدعومة في تلجرام، وستُعرض بكتلة نصية ثابتة العرض.',
    en: 'Telegram does not support tables; rendered as a monospace block.'
  },
  [WarningCode.IMAGE_AS_LINK]: {
    ar: 'الصور لا تُعرض داخل المنشور؛ سيظهر نص بديل ورابط.',
    en: 'Images are not rendered inside posts; alt text and a link are shown instead.'
  },
  [WarningCode.HR_AS_TEXT]: {
    ar: 'الفاصل الأفقي يُعرض كسطر من الرموز.',
    en: 'Horizontal rules are rendered as a line of symbols.'
  },
  [WarningCode.RAW_HTML_SHOWN_AS_TEXT]: {
    ar: 'وسوم HTML غير مدعومة وستظهر كنص عادي.',
    en: 'HTML tags are not supported and appear as literal text.'
  },
  [WarningCode.UNSAFE_LINK_AS_TEXT]: {
    ar: 'رابط بمخطط غير مدعوم (مثل javascript:) عُرض كنص فقط.',
    en: 'A link with an unsupported scheme (e.g. javascript:) was shown as plain text.'
  },
  [WarningCode.CODE_BLOCK_SPLIT]: {
    ar: 'كتلة كود أطول من رسالة واحدة قُسّمت إلى عدة رسائل.',
    en: 'A code block longer than one message was split across messages.'
  },
  [WarningCode.MESSAGE_SPLIT]: {
    ar: 'المحتوى أطول من رسالة تلجرام الواحدة وسيُنشر في عدة رسائل.',
    en: 'The content is longer than one Telegram message and will be published as several messages.'
  },
  [WarningCode.UNSUPPORTED_INLINE_AS_TEXT]: {
    ar: 'تنسيق غير مدعوم عُرض كنص عادي.',
    en: 'An unsupported formatting token was rendered as plain text.'
  }
};

export function makeWarning(code) {
  const m = MESSAGES[code] || { ar: code, en: code };
  return { code, messageAr: m.ar, messageEn: m.en };
}

/** يدمج التحذيرات المتكررة ويحسب عدد مرات ظهور كل منها. */
export function dedupeWarnings(list) {
  const map = new Map();
  for (const w of list) {
    if (!map.has(w.code)) map.set(w.code, { ...w, count: 0 });
    map.get(w.code).count += 1;
  }
  return [...map.values()];
}
