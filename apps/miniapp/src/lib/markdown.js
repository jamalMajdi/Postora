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

/* ==================================================================== */
/* عرض كيانات تلجرام بشكل مطابق لعميل تلجرام                             */
/* ==================================================================== */

/**
 * في عميل تلجرام الحقيقي:
 *  - كل كيان `blockquote` يُرسم **خطًا رأسيًا على يسار النص** (يسار دائمًا،
 *    حتى في الواجهة العربية لأن الاقتباس في تلجرام مبني على LTR للحدّ).
 *  - الكيانات المتداخلة تُرسم معًا (عريض داخل اقتباس = اقتباس + عريض).
 *
 * لذلك نبني هنا HTML من `text + entities` — وليس من `html` المحرك — لأن
 * `html` الذي ينتجه المحرك مسطّح (يفتح ويغلق الوسوم عند كل حدّ)، بينما
 * العميل الحقيقي يعرض الكيان ككتلة واحدة متصلة.
 *
 * ⚠️ الأمان: كل حرف من `text` يمر عبر `escapeHtml` — لا يُعرض أي HTML من
 * المستخدم (المحرك نفسه يستخدم html:false). الوسوم الوحيدة هي التي نولّدها.
 *
 * @param {string} text
 * @param {Array<any>} entities
 * @returns {string} HTML مُهرَّب وجاهز للعرض
 */
export function entitiesToPreviewHtml(text, entities = []) {
  if (!text) return '';
  const safeText = String(text);

  // ترتيب ثابت للتداخل: الخروج من الداخل إلى الخارج.
  const RANK = {
    bold: 1,
    italic: 2,
    underline: 3,
    strikethrough: 4,
    spoiler: 5,
    code: 6,
    pre: 7,
    blockquote: 8,
    text_link: 9,
    text_mention: 9
  };

  const opens = new Map(); // offset → [{tag, rank}]
  const closes = new Map(); // offset → [{tag, rank}]

  const add = (map, index, tag, rank) => {
    if (!map.has(index)) map.set(index, []);
    map.get(index).push({ tag, rank });
  };

  for (const entity of entities) {
    const openTag = OPEN_TAG[entity.type];
    const closeTag = CLOSE_TAG[entity.type];
    if (!openTag) continue;

    const start = Math.max(0, entity.offset);
    const end = Math.min(safeText.length, entity.offset + entity.length);
    if (end <= start) continue;

    const rank = RANK[entity.type] ?? 0;
    add(opens, start, openTag(entity), rank);
    add(closes, end, typeof closeTag === 'function' ? closeTag(entity) : closeTag, rank);
  }

  const renderList = (list) =>
    list
      .slice()
      .sort((a, b) => a.rank - b.rank || 0)
      .map((entry) => entry.tag)
      .join('');

  let html = '';
  for (let i = 0; i <= safeText.length; i += 1) {
    // الإغلاق بترتيب عكسي (من الداخل للخارج)
    if (closes.has(i)) {
      html += renderList(closes.get(i)).length
        ? closes
            .get(i)
            .slice()
            .sort((a, b) => b.rank - a.rank)
            .map((e) => e.tag)
            .join('')
        : '';
    }
    if (opens.has(i)) html += renderList(opens.get(i));
    if (i < safeText.length) html += escapeHtmlChar(safeText[i]);
  }

  return html;
}

const OPEN_TAG = {
  bold: () => '<b>',
  italic: () => '<i>',
  underline: () => '<u>',
  strikethrough: () => '<s>',
  spoiler: () => '<span class="tg-spoiler">',
  code: () => '<code>',
  // اصطلاح تلجرام: <pre><code class="language-x"> — يفعّل التمييز اللوني ويعرض اسم اللغة
  // مطابقة حرفية لـ packages/markdown-engine/src/serialize.js#tagsForEntity:
  //   لغة  ⇒ <pre><code class="language-x">…</code></pre>
  //   بلا لغة ⇒ <pre>…</pre>
  pre: (entity) =>
    entity.language
      ? `<pre><code class="language-${escapeHtmlAttr(entity.language)}">`
      : '<pre>',
  blockquote: () => '<span class="tg-quote">',
  text_link: (entity) =>
    `<a href="${escapeHtmlAttr(entity.url || '')}" target="_blank" rel="noopener noreferrer nofollow">`,
  text_mention: () => '<span class="tg-mention">'
};

const CLOSE_TAG = {
  bold: '</b>',
  italic: '</i>',
  underline: '</u>',
  strikethrough: '</s>',
  spoiler: '</span>',
  code: '</code>',
  pre: (entity) => (entity.language ? '</code></pre>' : '</pre>'),
  blockquote: '</span>',
  text_link: '</a>',
  text_mention: '</span>'
};

const HTML_ESCAPES = {
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#39;'
};

export function escapeHtmlChar(char) {
  return HTML_ESCAPES[char] ?? char;
}

export function escapeHtmlAttr(value) {
  return String(value).replace(/[&<>"']/g, (char) => HTML_ESCAPES[char]);
}

/* ==================================================================== */
/* اقتراح معاينة رابط مُصغّرة (لكشف سلوك تلجرام الحقيقي)                   */
/* ==================================================================== */

/**
 * ⚠️ مهم للدقة: Postora ينشر عبر `sendMessage` مع
 * `link_preview_options: { is_disabled: true }` (انظر
 * apps/server/src/telegram/publishing.js) — أي أن تلجرام **لا يعرض**
 * بطاقة معاينة للرابط. المعاينة هنا تحاكي ذلك وتشرحه للمستخدم بدل
 * إيهامه ببطاقة لن تظهر.
 *
 * @param {Array<any>} entities
 * @returns {{url:string, kind:'link'|'image'} | null}
 */
export function firstPreviewableLink(entities = []) {
  const link = entities.find((entity) => entity.type === 'text_link' && entity.url);
  if (!link) return null;
  const isImage = /\.(png|jpe?g|gif|webp|avif|bmp|svg)(\?.*)?$/i.test(link.url);
  return { url: link.url, kind: isImage ? 'image' : 'link' };
}
