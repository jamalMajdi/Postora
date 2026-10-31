/**
 * حدود ومحددات مشتركة بين الخادم والواجهة.
 * قيمة واحدة يعرفها الطرفان حتى تبقى المعاينة مطابقة للنتيجة النهائية.
 */

/** الحد الأقصى لطول نص رسالة تلجرام (وحدات UTF-16). مصدر: Telegram Bot API docs. */
export const TELEGRAM_MAX_MESSAGE_LENGTH = 4096;

/** هامش أمان مستهدف للتقسيم (لا يُرسل نص قرب الحد الأقصى). */
export const SPLIT_SOFT_LIMIT = 3072;

/** الحد الأقصى لعدد الرسائل التي يمكن أن ينتجها منشور واحد. */
export const DEFAULT_MAX_PUBLISH_MESSAGES = 20;

/** الحد الأقصى لحجم ملف .md المقبول (بايت). */
export const DEFAULT_MAX_UPLOAD_BYTES = 256 * 1024;

/** الحد الأقصى لعدد محارف Markdown الخام. */
export const DEFAULT_MAX_CONTENT_CHARS = 100_000;

/** امتدادات الملفات المدعومة. */
export const ALLOWED_MARKDOWN_EXTENSIONS = ['.md', '.markdown', '.mdown'];

/** أقصى طول لعنوان مستخرج من المحتوى. */
export const MAX_TITLE_LENGTH = 200;
