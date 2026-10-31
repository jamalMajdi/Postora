import {
  BLOCK_SEPARATOR,
  DEFAULT_MAX_MESSAGES,
  DEFAULT_SOFT_LIMIT,
  LIST_ITEM_SEPARATOR,
  Mark,
  TELEGRAM_HARD_LIMIT
} from './constants.js';
import { isSplitInsideSurrogatePair } from './measure.js';
import { WarningCode } from './warnings.js';

/**
 * تقسيم المحتوى إلى رسائل تلجرام.
 *
 * المبادئ:
 *  1) القياس على النص النهائي بعد التحويل (لا على Markdown).
 *  2) لا حذف ولا اختصار: كل محرف يُنقل إلى رسالة.
 *  3) التقسيم على حدود الكتل أولًا، ثم حدود الأسطر، ثم حدود الكلمات.
 *  4) عند تقسيم كتلة، تُعاد العلامات (bold/italic/...) لكل جزء لأن كل رسالة مستقلة.
 *
 * @param {Array} segBlocks مخرجات segments.js
 * @param {{softLimit?: number, maxMessages?: number, hardLimit?: number}} options
 * @returns {{chunks: Segment[][], warnings: string[], totalChars: number}}
 */
export function splitIntoChunks(segBlocks, options = {}) {
  const softLimit = options.softLimit ?? DEFAULT_SOFT_LIMIT;
  const maxMessages = options.maxMessages ?? DEFAULT_MAX_MESSAGES;
  const hardLimit = options.hardLimit ?? TELEGRAM_HARD_LIMIT;

  const blocks = segBlocks
    .map((block) => ({ ...block, segments: trimBlockEdges(block.segments) }))
    .filter((block) => block.segments.length > 0);

  const warnings = [];
  /** @type {Array<Array<{text:string, marks:any[]}>>} */
  const chunks = [];
  let current = [];
  let currentLength = 0;

  const flush = () => {
    if (current.length > 0) {
      chunks.push(trimSegments(current));
      current = [];
      currentLength = 0;
    }
  };

  for (let index = 0; index < blocks.length; index += 1) {
    const block = blocks[index];
    const separator = separatorBefore(blocks, index);
    const blockLength = segmentsLength(block.segments);
    const needed = blockLength + (current.length > 0 ? separator.length : 0);

    if (currentLength + needed <= softLimit) {
      if (current.length > 0 && separator) current.push({ text: separator, marks: [] });
      current.push(...block.segments);
      currentLength += needed;
      continue;
    }

    // الكتلة نفسها أطول من الحد المسموح → يجب تقسيمها
    if (blockLength > softLimit) {
      flush();
      const pieces = splitBlock(block, softLimit, warnings);
      let carry = [];
      for (const piece of pieces) {
        const pieceLength = segmentsLength(piece);
        if (currentLength + pieceLength + (current.length ? separator.length : 0) > softLimit) {
          flush();
        }
        if (current.length > 0 && separator) {
          current.push({ text: separator, marks: [] });
          currentLength += separator.length;
        }
        current.push(...piece);
        currentLength += pieceLength;
        carry = [];
      }
      void carry;
      continue;
    }

    // الكتلة تُنقل إلى رسالة جديدة
    flush();
    current.push(...block.segments);
    currentLength = blockLength;
  }

  flush();

  if (chunks.length === 0) {
    return { chunks: [], warnings, totalChars: 0 };
  }

  if (chunks.length > maxMessages) {
    const err = new Error('TOO_MANY_MESSAGES');
    err.code = 'TOO_MANY_MESSAGES';
    err.details = { chunks: chunks.length, maxMessages };
    throw err;
  }

  // تحقق أمان نهائي: أي رسالة تتجاوز الحد الصارم تُقسَّم مرة أخرى
  const safeChunks = [];
  for (const chunk of chunks) {
    if (segmentsLength(chunk) <= hardLimit) {
      safeChunks.push(chunk);
    } else {
      warnings.push(WarningCode.MESSAGE_SPLIT);
      for (const piece of splitSegmentsByLimit(chunk, hardLimit - 1)) {
        safeChunks.push(piece);
      }
    }
  }

  // تمريرة أخيرة: تلجرام يسمح بـ 100 كيان لكل رسالة كحد أقصى.
  // إن تجاوزت رسالة هذا الحد نُقسّمها إلى رسائل أصغر (نقل لا حذف).
  const entitySafeChunks = [];
  for (const chunk of safeChunks) {
    entitySafeChunks.push(...splitByEntityBudget(chunk, options.maxEntities ?? 100));
  }

  const totalChars = entitySafeChunks.reduce((sum, chunk) => sum + segmentsLength(chunk), 0);

  if (entitySafeChunks.length > 1) warnings.push(WarningCode.MESSAGE_SPLIT);
  if (entitySafeChunks.length > maxMessages) {
    const err = new Error('TOO_MANY_MESSAGES');
    err.code = 'TOO_MANY_MESSAGES';
    err.details = { chunks: entitySafeChunks.length, maxMessages };
    throw err;
  }

  return { chunks: entitySafeChunks, warnings, totalChars };
}

/**
 * يقسّم مقاطع حتى لا يتجاوز عدد الكيانات المولّدة الحد المسموح لكل رسالة.
 * يحسب عدد الكيانات تقديريًا: كل انتقال بين علامتين ينتج كيانًا واحدًا على الأقل.
 * @param {Array<{text:string, marks:any[]}>} segments
 * @param {number} budget
 * @returns {Array<Array<{text:string, marks:any[]}>>}
 */
export function splitByEntityBudget(segments, budget) {
  const pieces = [];
  let current = [];
  let currentCount = 0;

  const countFor = (segment, previousMarks) => {
    // كل اختلاف في مستوى العلامات ينتج كيانَين على الأقل (إغلاق + فتح).
    // نقدّر بـ 2 لكل اختلاف لنبقى في الجانب الآمن تجاه حد تلجرام (100 كيان).
    const prev = previousMarks || [];
    const next = segment.marks || [];
    let transitions = 0;
    for (let i = 0; i < Math.max(prev.length, next.length); i += 1) {
      const p = prev[i];
      const n = next[i];
      const same = p && n && p.type === n.type && (p.type !== 'link' || p.href === n.link);
      if (!same) transitions += 1;
    }
    return Math.max(transitions * 2, 1);
  };

  let previousMarks = [];
  for (const segment of segments) {
    const cost = countFor(segment, previousMarks);
    if (currentCount + cost > budget && current.length > 0) {
      pieces.push(current);
      current = [];
      currentCount = 0;
      previousMarks = [];
    }
    current.push(segment);
    currentCount += countFor(segment, previousMarks);
    previousMarks = segment.marks || [];
  }
  if (current.length > 0) pieces.push(current);
  return pieces.length > 0 ? pieces : [segments];
}

/** الفاصل المناسب قبل الكتلة رقم index. */
function separatorBefore(blocks, index) {
  if (index === 0) return '';
  const prev = blocks[index - 1];
  const current = blocks[index];
  if (prev.type === 'listItem' && current.type === 'listItem') return LIST_ITEM_SEPARATOR;
  return BLOCK_SEPARATOR;
}

/**
 * يقسّم كتلة واحدة أطول من الحد إلى عدة قطع.
 * @returns {Array<Segment[]>}
 */
function splitBlock(block, limit, warnings) {
  const pieces = [];

  if (block.type === 'codeBlock') {
    warnings.push(WarningCode.CODE_BLOCK_SPLIT);
    const preMark = block.segments[0]?.marks?.find((m) => m.type === Mark.PRE) || {
      type: Mark.PRE,
      language: ''
    };
    const text = segmentsToText(block.segments);
    for (const part of splitTextByLimit(text, limit - 1, true)) {
      pieces.push([{ text: part, marks: [preMark] }]);
    }
    return pieces;
  }

  // النص والاقتباسات والعناوين والجداول: تقسيم على حدود الكلمات مع الحفاظ على العلامات
  for (const part of splitSegmentsByLimit(block.segments, limit)) {
    pieces.push(part);
  }
  return pieces;
}

/**
 * يقسّم مقاطع نصية مع الحفاظ على علاماتها.
 * @param {Array<{text:string, marks:any[]}>} segments
 * @param {number} limit
 * @returns {Array<Array<{text:string, marks:any[]}>>}
 */
export function splitSegmentsByLimit(segments, limit) {
  const out = [];
  let remaining = segments.filter((s) => s.text.length > 0);

  while (segmentsLength(remaining) > limit) {
    const cut = findCutIndex(remaining, limit);
    const { head, tail } = sliceSegments(remaining, cut);
    const trimmedHead = trimSegments(head);
    if (trimmedHead.length === 0) {
      // لا يمكن التقدم: نأخذ ما أمكن ونكمل
      out.push(head);
      remaining = trimSegmentsLeading(tail);
      continue;
    }
    out.push(trimmedHead);
    remaining = trimSegmentsLeading(tail);
  }

  const last = trimSegments(remaining);
  if (last.length > 0) out.push(last);
  return out;
}

/**
 * يحدد موضع القطع المفضّل داخل المقاطع.
 * أولوية: فاصل سطر، ثم مسافة، ثم قطع صلب آمن.
 */
function findCutIndex(segments, limit) {
  const text = segmentsToText(segments);
  const minCut = Math.floor(limit * 0.5);
  const window = text.slice(minCut, limit);

  const lastNewline = window.lastIndexOf('\n');
  if (lastNewline !== -1) return minCut + lastNewline + 1;

  const lastSpace = window.search(/\s\S*$/);
  if (lastSpace !== -1) return minCut + lastSpace + 1;

  let index = limit;
  if (isSplitInsideSurrogatePair(text, index)) index -= 1;
  return Math.max(1, index);
}

/** يجزئ النص إلى قطع بحيث لا تتجاوز الحد، مع خيار القطع على الأسطر فقط. */
function splitTextByLimit(text, limit, byLinesOnly) {
  const parts = [];
  let rest = text;

  while (rest.length > limit) {
    let cut = -1;
    if (byLinesOnly) {
      const nl = rest.lastIndexOf('\n', limit);
      if (nl > 0) cut = nl + 1;
    }
    if (cut === -1) {
      const minCut = Math.floor(limit * 0.5);
      const window = rest.slice(minCut, limit);
      const nl = window.lastIndexOf('\n');
      if (byLinesOnly && nl !== -1) cut = minCut + nl + 1;
      else {
        const sp = window.search(/\s\S*$/);
        cut = sp !== -1 ? minCut + sp + 1 : limit;
      }
    }
    let safeCut = cut;
    if (isSplitInsideSurrogatePair(rest, safeCut)) safeCut -= 1;
    if (safeCut <= 0) safeCut = 1;
    parts.push(rest.slice(0, safeCut));
    rest = rest.slice(safeCut);
  }
  if (rest.length > 0) parts.push(rest);
  return parts;
}

/* --------------------------- أدوات المقاطع --------------------------- */

export function segmentsLength(segments) {
  return segments.reduce((sum, s) => sum + s.text.length, 0);
}

export function segmentsToText(segments) {
  return segments.map((s) => s.text).join('');
}

/** يجزئ المقاطع عند فهرس حرف معيّن (لا يكسر العلامات بل يعيد بناءها). */
export function sliceSegments(segments, cut) {
  const head = [];
  const tail = [];
  let offset = 0;

  for (const segment of segments) {
    const start = offset;
    const end = offset + segment.text.length;
    if (end <= cut) {
      head.push(segment);
    } else if (start >= cut) {
      tail.push(segment);
    } else {
      const splitAt = cut - start;
      head.push({ text: segment.text.slice(0, splitAt), marks: segment.marks });
      tail.push({ text: segment.text.slice(splitAt), marks: segment.marks });
    }
    offset = end;
  }

  return { head, tail };
}

export function trimSegments(segments) {
  return trimSegmentsLeading(trimSegmentsTrailing(segments));
}

/**
 * تنظيف حدود الكتلة مع **الحفاظ على المسافات البادئة** (لأنها تمثل تداخل القوائم
 * وهي جزء من النص المرسل فعليًا إلى تلجرام).
 * يزيل فقط أسطرًا فارغة في البداية ومسافات في النهاية.
 */
export function trimBlockEdges(segments) {
  const copy = segments.map((s) => ({ ...s, marks: [...(s.marks || [])] }));
  while (copy.length > 0) {
    copy[0].text = copy[0].text.replace(/^\n+/, '');
    if (copy[0].text.length > 0) break;
    copy.shift();
  }
  while (copy.length > 0) {
    const last = copy[copy.length - 1];
    last.text = last.text.replace(/[ \t]+$/, '').replace(/\n+$/, '');
    if (last.text.length > 0) break;
    copy.pop();
  }
  return copy.filter((s) => s.text.length > 0);
}

export function trimSegmentsLeading(segments) {
  const copy = segments.map((s) => ({ ...s, marks: [...(s.marks || [])] }));
  while (copy.length > 0) {
    copy[0].text = copy[0].text.replace(/^[\s]+/, '');
    if (copy[0].text.length > 0) break;
    copy.shift();
  }
  return copy.filter((s) => s.text.length > 0);
}

export function trimSegmentsTrailing(segments) {
  const copy = segments.map((s) => ({ ...s, marks: [...(s.marks || [])] }));
  while (copy.length > 0) {
    const last = copy[copy.length - 1];
    last.text = last.text.replace(/[\s]+$/, '');
    if (last.text.length > 0) break;
    copy.pop();
  }
  return copy.filter((s) => s.text.length > 0);
}
