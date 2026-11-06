/**
 * استيراد ملف Markdown نصي إلى المحرر.
 *
 * قيود الأمان:
 *  - الأنواع المسموحة نصية فقط (لا HTML، لا تنفيذ).
 *  - قراءة عبر FileReader/File.text — لا رفع إلى أي خدمة.
 *  - حدّ حجم صريح لمنع تجميد الواجهة على ملفات ضخمة.
 */

export const MAX_IMPORT_BYTES = 512 * 1024; // 512 كيلوبايت

const ALLOWED_EXTENSIONS = ['.md', '.markdown', '.txt', '.mdown', '.mkd'];
const ALLOWED_MIME = [
  'text/markdown',
  'text/plain',
  'text/x-markdown',
  'application/octet-stream' // بعض المتصفحات لا تعرف امتداد .md
];

/**
 * هل الملف مقبول كملف Markdown نصي؟
 * نعتمد على الامتداد أساسًا (الـ MIME لملفات .md غير موحّد).
 */
export function isMarkdownFile(file) {
  if (!file) return false;
  const name = (file.name || '').toLowerCase();
  const extensionOk = ALLOWED_EXTENSIONS.some((ext) => name.endsWith(ext));
  const mimeOk = !file.type || ALLOWED_MIME.includes(file.type);
  return extensionOk && mimeOk;
}

/** هل الملف أكبر من الحد؟ */
export function isTooLarge(file) {
  return Boolean(file && file.size > MAX_IMPORT_BYTES);
}

/**
 * يقرأ الملف كنص.
 * @param {File} file
 * @returns {Promise<string>}
 */
export function readMarkdownFile(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('READ_FAILED'));
    reader.onload = () => {
      const text = String(reader.result ?? '');
      // إزالة BOM إن وُجد (يُفسد أول عنوان)
      resolve(text.replace(/^\uFEFF/, ''));
    };
    reader.readAsText(file, 'utf-8');
  });
}
