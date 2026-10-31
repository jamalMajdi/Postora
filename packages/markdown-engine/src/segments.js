import {
  BULLET_CHAR,
  HR_TEXT,
  IMAGE_PREFIX,
  Mark,
  TELEGRAM_HARD_LIMIT
} from './constants.js';
import { WarningCode } from './warnings.js';

/**
 * مرحلة التصيير: كتل المحرك ← مقاطع نصية نهائية مع علامات (marks).
 *
 * عقد المخرج لكل كتلة:
 *   SegmentBlock = {
 *     type: 'heading'|'paragraph'|'codeBlock'|'blockquote'|'listItem'|'hr'|'table',
 *     segments: Segment[],
 *     atomic: boolean,       // true = لا يُكسر داخل السطر إلا عند الضرورة القصوى
 *     keepWithNext: boolean  // لا يُفصل عن الكتلة التالية إن أمكن
 *   }
 *   Segment = { text: string, marks: Mark[] }
 *
 * النص هنا هو النص الظاهر فعليًا في تلجرام — وقياس الطول يعتمد عليه لا على Markdown.
 */

/**
 * @param {import('./types.js').Block[]} blocks
 * @param {{warnings: string[]}} state
 * @returns {SegmentBlock[]}
 */
export function renderBlocksToSegments(blocks, state) {
  const out = [];
  for (const block of blocks) {
    out.push(...renderBlock(block, state));
  }
  return out;
}

function renderBlock(block, state) {
  switch (block.type) {
    case 'heading': {
      state.warnings.push(WarningCode.HEADING_AS_BOLD);
      // مستوى العنوان يُحاكى بفاصل بصري: H1/H2 سطر عريض مستقل، وما بعدهما سطر عريض أصغر دلاليًا.
      const segments = inlineToSegments(block.children, [{ type: Mark.BOLD }]);
      return [
        {
          type: 'heading',
          level: block.level,
          segments: trimSegmentsEnds(segments),
          atomic: false,
          keepWithNext: true
        }
      ];
    }

    case 'paragraph':
      return [
        {
          type: 'paragraph',
          segments: inlineToSegments(block.children, []),
          atomic: false,
          keepWithNext: false
        }
      ];

    case 'codeBlock': {
      const segments = [{ text: block.text, marks: [{ type: Mark.PRE, language: block.language }] }];
      return [
        {
          type: 'codeBlock',
          language: block.language,
          segments,
          atomic: false, // يمكن تقسيمه على حدود الأسطر
          keepWithNext: false
        }
      ];
    }

    case 'blockquote': {
      const inner = renderBlocksToSegments(block.blocks, state);
      const flat = flattenBlocks(inner);
      const quoted = flat.map((seg) => ({
        text: seg.text,
        marks: dedupe([{ type: Mark.BLOCKQUOTE }, ...seg.marks])
      }));
      return [
        {
          type: 'blockquote',
          segments: quoted,
          atomic: false,
          keepWithNext: false
        }
      ];
    }

    case 'list':
      return renderList(block, state);

    case 'hr':
      state.warnings.push(WarningCode.HR_AS_TEXT);
      return [
        {
          type: 'hr',
          segments: [{ text: HR_TEXT, marks: [] }],
          atomic: true,
          keepWithNext: false
        }
      ];

    case 'table':
      return renderTable(block, state);

    default:
      state.warnings.push(WarningCode.UNSUPPORTED_INLINE_AS_TEXT);
      return [];
  }
}

/**
 * تلجرام لا يدعم القوائم، فنحوّلها إلى أسطر مع علامة بصرية.
 * القوائم المتداخلة تُحاكى بمسافات بادئة. الفقرة الأولى في العنصر تُدمج مع العلامة،
 * وبقية الكتل تُعرض كأسطر متابعة بنفس الإزاحة.
 */
function renderList(list, state) {
  state.warnings.push(WarningCode.LIST_AS_TEXT);
  if (list.depth > 0) state.warnings.push(WarningCode.NESTED_LIST_AS_TEXT);

  const out = [];
  list.items.forEach((item, index) => {
    const marker = list.ordered ? `${list.start + index}. ` : `${BULLET_CHAR} `;
    const indent = '  '.repeat(list.depth);
    const itemBlocks = renderBlocksToSegments(item.blocks, state);

    if (itemBlocks.length === 0) {
      out.push({
        type: 'listItem',
        segments: [{ text: `${indent}${marker.trimEnd()}`, marks: [] }],
        atomic: true,
        keepWithNext: false
      });
      return;
    }

    const [first, ...rest] = itemBlocks;
    out.push({
      type: 'listItem',
      depth: list.depth,
      segments: [{ text: `${indent}${marker}`, marks: [] }, ...first.segments],
      atomic: false,
      keepWithNext: rest.length > 0
    });

    const continuationIndent = ' '.repeat(indent.length + marker.length);
    for (const block of rest) {
      if (block.type === 'listItem') {
        // قائمة متداخلة: أسطرها تحمل إزاحتها الخاصة بالفعل
        out.push(block);
      } else {
        out.push(indentBlock(block, continuationIndent));
      }
    }
  });

  return out;
}

function renderTable(table, state) {
  state.warnings.push(WarningCode.TABLE_AS_MONOSPACE);
  const lines = [];

  const cellText = (cells) => cells.map((c) => inlineToPlainText(c.inline)).join('  |  ');

  if (table.header.length > 0) {
    lines.push(cellText(table.header));
    const width = lines[0].length;
    lines.push('─'.repeat(Math.min(width, 40)));
  }
  for (const row of table.rows) {
    lines.push(cellText(row.cells));
  }

  return [
    {
      type: 'table',
      segments: [{ text: lines.join('\n'), marks: [{ type: Mark.PRE, language: '' }] }],
      atomic: false,
      keepWithNext: false
    }
  ];
}

/* ------------------------------------------------------------------ */
/* أدوات مساعدة                                                       */
/* ------------------------------------------------------------------ */

function inlineToSegments(nodes, baseMarks) {
  const out = [];
  for (const node of nodes) {
    if (node.type !== 'text') continue;
    const marks = dedupe([...baseMarks.map((m) => m), ...(node.marks || [])]);
    const text = node.text.startsWith(IMAGE_PREFIX) ? node.text : node.text;
    if (!text) continue;
    out.push({ text, marks });
  }
  return mergeSegments(out);
}

function inlineToPlainText(nodes) {
  return nodes
    .filter((n) => n.type === 'text')
    .map((n) => n.text)
    .join('');
}

function indentBlock(block, indent) {
  return {
    ...block,
    segments: block.segments.map((seg, i) =>
      i === 0 && indent ? { ...seg, text: indent + seg.text } : seg
    )
  };
}

/** يجعل الكتل المتداخلة مسطّحة (للاقتباسات). */
function flattenBlocks(blocks) {
  const out = [];
  blocks.forEach((b, i) => {
    b.segments.forEach((seg, j) => {
      const isLastSeg = j === b.segments.length - 1;
      const isLastBlock = i === blocks.length - 1;
      const sep = isLastBlock && isLastSeg ? '' : '\n';
      out.push({ text: seg.text + sep, marks: seg.marks });
    });
  });
  return mergeSegments(out);
}

function trimSegmentsEnds(segments) {
  const copy = segments.map((s) => ({ ...s }));
  if (copy.length === 0) return copy;
  copy[0].text = copy[0].text.replace(/^[ \t]+/, '');
  const last = copy[copy.length - 1];
  last.text = last.text.replace(/[ \t]+$/, '');
  return copy.filter((s) => s.text.length > 0);
}

export function mergeSegments(segments) {
  const out = [];
  for (const seg of segments) {
    if (!seg.text) continue;
    const prev = out[out.length - 1];
    if (prev && sameMarks(prev.marks, seg.marks)) {
      prev.text += seg.text;
    } else {
      out.push({ text: seg.text, marks: seg.marks });
    }
  }
  return out;
}

export function sameMarks(a = [], b = []) {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i += 1) {
    if (a[i].type !== b[i].type) return false;
    if (a[i].type === Mark.LINK && a[i].href !== b[i].href) return false;
    if (a[i].type === Mark.PRE && a[i].language !== b[i].language) return false;
  }
  return true;
}

function dedupe(marks) {
  const seen = new Set();
  const out = [];
  for (const m of marks) {
    const key = m.type === Mark.LINK ? `link:${m.href}` : m.type;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(m);
  }
  return out;
}

export { TELEGRAM_HARD_LIMIT };
