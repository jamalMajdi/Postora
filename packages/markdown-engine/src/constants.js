/**
 * ثوابت محرك Markdown.
 * ترتيب العلامات (MARK_RANK) يحدد تسلسل فتح/إغلاق الوسوم عند التوليد،
 * حتى يكون HTML صحيح التداخل دائمًا.
 */

export const TELEGRAM_HARD_LIMIT = 4096;
export const DEFAULT_SOFT_LIMIT = 3072;
export const DEFAULT_MAX_MESSAGES = 40;

/** أنواع العلامات المدعومة. */
export const Mark = Object.freeze({
  BLOCKQUOTE: 'blockquote',
  PRE: 'pre',
  CODE: 'code',
  BOLD: 'bold',
  ITALIC: 'italic',
  STRIKE: 'strike',
  UNDERLINE: 'underline',
  SPOILER: 'spoiler',
  LINK: 'link'
});

/** ترتيب ثابت — الأصغر يُفتح أولًا ويُغلق أخيرًا. */
export const MARK_RANK = Object.freeze({
  [Mark.BLOCKQUOTE]: 0,
  [Mark.PRE]: 1,
  [Mark.BOLD]: 3,
  [Mark.ITALIC]: 4,
  [Mark.STRIKE]: 5,
  [Mark.UNDERLINE]: 6,
  [Mark.SPOILER]: 7,
  [Mark.CODE]: 8,
  [Mark.LINK]: 9
});

/** فاصل بين الكتل المستقلة. */
export const BLOCK_SEPARATOR = '\n\n';

/** فاصل بين عناصر القائمة نفسها. */
export const LIST_ITEM_SEPARATOR = '\n';

/** محرف القائمة غير المرتبة (لا يدعم تلجرام القوائم). */
export const BULLET_CHAR = '•';

/** محرف الخط الأفقي البديل. */
export const HR_TEXT = '──────────';

/** بادئة الصورة بدل عرضها داخل النص. */
export const IMAGE_PREFIX = '🖼 ';

/** أنواع الكيانات المدعومة في Telegram Bot API (HTML). */
export const TELEGRAM_ALLOWED_TAGS = Object.freeze([
  'b',
  'strong',
  'i',
  'em',
  'u',
  's',
  'strike',
  'del',
  'a',
  'code',
  'pre',
  'blockquote',
  'tg-spoiler'
]);

/** مخططات الروابط المسموح بها فقط — أي مخطط آخر يُعرض كنص. */
export const ALLOWED_LINK_PROTOCOLS = Object.freeze(['http:', 'https:', 'tg:', 'mailto:']);
