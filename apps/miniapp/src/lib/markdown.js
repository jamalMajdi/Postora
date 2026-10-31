import { renderToTelegram } from '@postora/markdown-engine';

/**
 * المعاينة في الواجهة تستخدم **نفس حزمة المحرك** المستخدمة في الخادم.
 * هذا هو جوهر تطابق المعاينة مع النتيجة النهائية (architecture.md §5):
 * نفس النص، نفس الكيانات، نفس التقسيم — بلا أي تنفيذ ثانٍ للمنطق.
 *
 * @param {string} markdown
 * @returns {{messages: Array<{text:string, entities:any[], html:string, length:number}>, warnings: any[], stats: any}|{error:string}}
 */
export function renderPreview(markdown) {
  if (!markdown || markdown.trim().length === 0) {
    return { messages: [], warnings: [], stats: { messagesCount: 0, totalChars: 0 } };
  }

  try {
    return renderToTelegram(markdown, { maxMessages: 40 });
  } catch (error) {
    return {
      messages: [],
      warnings: [],
      stats: { messagesCount: 0, totalChars: 0 },
      error: error?.code === 'TOO_MANY_MESSAGES' ? 'TOO_MANY_MESSAGES' : 'RENDER_FAILED'
    };
  }
}

/** يقارن مخرجات الواجهة بمخرجات الخادم (للتحقق من التطابق). */
export function fingerprintPreview(result) {
  if (!result?.messages) return '';
  return result.messages
    .map((m) => `${m.text}|${(m.entities || []).map((e) => `${e.type}:${e.offset}:${e.length}`).join(',')}`)
    .join('::');
}
