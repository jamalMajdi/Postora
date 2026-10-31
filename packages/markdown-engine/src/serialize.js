import { MARK_RANK, Mark } from './constants.js';
import { escapeHtml, escapeHtmlAttribute } from './escape.js';

/** الحد الأقصى لعدد الكيانات في رسالة تلجرام واحدة. */
export const MAX_ENTITIES_PER_MESSAGE = 100;

/**
 * يحوّل مقاطع نصية (segments) إلى:
 *  - text: النص الظاهر فقط
 *  - entities: [{type, offset, length, ...}] بإزاحات محسوبة على النص النهائي
 *  - html: تمثيل HTML الصحيح التداخل (يُستخدم في وضع parse_mode=HTML)
 *
 * الطريقة: مكدّس مفتوح/مغلق مرتب بترتيب ثابت (MARK_RANK) لضمان تداخل صحيح،
 * ثم دمج الكيانات المتلاصقة لتقليل العدد (تلجرام يحدد 100 كيان لكل رسالة).
 *
 * @param {Array<{text: string, marks: any[]}>} segments
 */
export function serializeSegments(segments) {
  const cleanSegments = segments.filter((s) => s && s.text && s.text.length > 0);
  const text = cleanSegments.map((s) => s.text).join('');

  const entities = [];
  /** @type {Array<{mark:any,start:number}>} */
  const open = [];
  let offset = 0;

  const closeTo = (targetCount) => {
    while (open.length > targetCount) {
      const top = open.pop();
      const length = offset - top.start;
      if (length > 0) entities.push(makeEntity(top.mark, top.start, length));
    }
  };

  for (const segment of cleanSegments) {
    const targetMarks = sortMarks(segment.marks || []);

    // 1) أغلق ما ليس في الهدف (من الأعلى)
    let common = 0;
    while (
      common < open.length &&
      common < targetMarks.length &&
      sameMark(open[common].mark, targetMarks[common])
    ) {
      common += 1;
    }
    closeTo(common);

    // 2) افتح الناقص حسب الترتيب
    for (let i = open.length; i < targetMarks.length; i += 1) {
      open.push({ mark: targetMarks[i], start: offset });
    }

    offset += segment.text.length;
  }
  closeTo(0);

  const merged = mergeEntities(entities);

  return {
    text,
    entities: merged,
    html: entitiesToHtml(text, merged)
  };
}

function makeEntity(mark, offset, length) {
  switch (mark.type) {
    case Mark.BOLD:
      return { type: 'bold', offset, length };
    case Mark.ITALIC:
      return { type: 'italic', offset, length };
    case Mark.STRIKE:
      return { type: 'strikethrough', offset, length };
    case Mark.UNDERLINE:
      return { type: 'underline', offset, length };
    case Mark.CODE:
      return { type: 'code', offset, length };
    case Mark.PRE:
      return { type: 'pre', offset, length, language: mark.language || '' };
    case Mark.BLOCKQUOTE:
      return { type: 'blockquote', offset, length };
    case Mark.SPOILER:
      return { type: 'spoiler', offset, length };
    case Mark.LINK:
      return { type: 'text_link', offset, length, url: mark.href };
    default:
      return { type: 'unknown', offset, length };
  }
}

/** ترتيب ثابت: الأصغر رتبة أولًا. */
function sortMarks(marks) {
  return [...marks].sort((a, b) => (MARK_RANK[a.type] ?? 99) - (MARK_RANK[b.type] ?? 99));
}

function sameMark(a, b) {
  if (a.type !== b.type) return false;
  if (a.type === Mark.LINK) return a.href === b.href;
  if (a.type === Mark.PRE) return (a.language || '') === (b.language || '');
  return true;
}

/**
 * دمج الكيانات المتلاصقة من نفس النوع (تقليل العدد وتفادي حد 100 كيان).
 */
export function mergeEntities(entities) {
  const sorted = [...entities].sort((a, b) => {
    if (a.offset !== b.offset) return a.offset - b.offset;
    return b.length - a.length;
  });
  const out = [];
  for (const entity of sorted) {
    const last = out[out.length - 1];
    if (
      last &&
      last.type === entity.type &&
      last.offset + last.length === entity.offset &&
      (entity.type !== 'text_link' || last.url === entity.url) &&
      (entity.type !== 'pre' || (last.language || '') === (entity.language || ''))
    ) {
      last.length += entity.length;
    } else {
      out.push({ ...entity });
    }
  }
  return out;
}

/**
 * يحوّل النص + الكيانات إلى HTML متوافق مع Telegram Bot API.
 * الترتيب: الكيانات الأطول أولًا حتى تُغلق الوسوم بتداخل صحيح.
 */
export function entitiesToHtml(text, entities) {
  if (!text) return '';
  const opens = new Map(); // index → tags
  const closes = new Map(); // index → tags

  for (const entity of entities) {
    const [openTag, closeTag] = tagsForEntity(entity);
    if (!openTag) continue;
    pushTo(opens, entity.offset, openTag);
    pushTo(closes, entity.offset + entity.length, closeTag);
  }

  let html = '';
  for (let i = 0; i <= text.length; i += 1) {
    if (closes.has(i)) {
      // البادئة عكسية لأن الإغلاق من الداخل للخارج
      html += closes.get(i).slice().reverse().join('');
    }
    if (opens.has(i)) {
      html += opens.get(i).join('');
    }
    if (i < text.length) {
      html += escapeHtml(text[i]);
    }
  }
  return html;
}

function tagsForEntity(entity) {
  switch (entity.type) {
    case 'bold':
      return ['<b>', '</b>'];
    case 'italic':
      return ['<i>', '</i>'];
    case 'strikethrough':
      return ['<s>', '</s>'];
    case 'underline':
      return ['<u>', '</u>'];
    case 'code':
      return ['<code>', '</code>'];
    case 'pre':
      return entity.language
        ? [`<pre><code class="language-${escapeHtmlAttribute(entity.language)}">`, '</code></pre>']
        : ['<pre>', '</pre>'];
    case 'blockquote':
      return ['<blockquote>', '</blockquote>'];
    case 'spoiler':
      return ['<tg-spoiler>', '</tg-spoiler>'];
    case 'text_link':
      return [`<a href="${escapeHtmlAttribute(entity.url)}">`, '</a>'];
    default:
      return [null, null];
  }
}

function pushTo(map, key, value) {
  if (!map.has(key)) map.set(key, []);
  map.get(key).push(value);
}
