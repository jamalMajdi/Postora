import MarkdownIt from 'markdown-it';

/**
 * إعداد markdown-it.
 * قرارات مهمة:
 *  - html: false  → أي HTML خام من المستخدم لا يُفسَّر ولا يمكنه صناعة تنسيق.
 *  - linkify: true → تحويل الروابط المجردة إلى روابط.
 *  - typographer: false → لا نغيّر محارف المستخدم (يُفسد العربية والرموز).
 *  - breaks: false → نحترم فواصل الأسطر كما كتبها المستخدم فقط عبر الكتل.
 */
export function createMarkdownParser() {
  return new MarkdownIt({
    html: false,
    xhtmlOut: false,
    breaks: false,
    linkify: true,
    typographer: false
  });
}

const parser = createMarkdownParser();

/**
 * يحلل نص Markdown إلى شجرة كتل مُبسّطة — لا HTML، لا قواعد بيانات.
 * مخرجات هذه الدالة هي عقد (contract) المرحلة التالية.
 *
 * @param {string} markdown
 * @returns {{blocks: any[], warnings: string[]}}
 */
export function parseToBlocks(markdown) {
  const tokens = parser.parse(markdown || '', {});
  const { blocks, warnings } = buildBlocks(tokens);
  return { blocks, warnings };
}

/* ------------------------------------------------------------------ */
/* تحويل توكنز markdown-it إلى شجرة كتل مبسطة                          */
/* ------------------------------------------------------------------ */

const HEADING = /^h([1-6])$/;

/**
 * كشف وسوم HTML المكتوبة كنص (لأن html:false يعرضها حرفيًا).
 * الشرط: "<" ثم حرف ثم أي شيء حتى ">" — يتجنب الخلط مع "5 < 10 > 5".
 */
const LOOKS_LIKE_HTML_TAG = /<\/?[a-zA-Z][^<>]*>/;

function buildBlocks(tokens) {
  const state = {
    blocks: [],
    warnings: []
  };

  let i = 0;

  // مكدّس القوائم المفتوحة (بما فيها المتداخلة)
  const listStack = [];

  while (i < tokens.length) {
    const token = tokens[i];

    /* ---------------- العناوين ---------------- */
    if (token.type === 'heading_open') {
      const level = Number(HEADING.exec(token.tag)?.[1] || 1);
      const inline = tokens[i + 1];
      const text = inline && inline.type === 'inline' ? inline.children || [] : [];
      const node = {
        type: 'heading',
        level,
        children: buildInline(text, state)
      };
      state.blocks.push(node);
      i = skipTo(tokens, i, 'heading_close');
      continue;
    }

    /* ---------------- الفقرات ---------------- */
    if (token.type === 'paragraph_open') {
      const inline = tokens[i + 1];
      const children = inline && inline.type === 'inline' ? inline.children || [] : [];
      pushBlock(state, listStack, { type: 'paragraph', children: buildInline(children, state) });
      i = skipTo(tokens, i, 'paragraph_close');
      continue;
    }

    /* ---------------- كتل الكود ---------------- */
    if (token.type === 'fence' || token.type === 'code_block') {
      const info = (token.info || '').trim().split(/\s+/)[0] || '';
      pushBlock(state, listStack, {
        type: 'codeBlock',
        language: info,
        text: token.content.replace(/\n$/, '')
      });
      i += 1;
      continue;
    }

    /* ---------------- الاقتباسات ---------------- */
    if (token.type === 'blockquote_open') {
      const inner = [];
      let depth = 1;
      i += 1;
      while (i < tokens.length && depth > 0) {
        if (tokens[i].type === 'blockquote_open') depth += 1;
        if (tokens[i].type === 'blockquote_close') {
          depth -= 1;
          if (depth === 0) break;
        }
        inner.push(tokens[i]);
        i += 1;
      }
      const nested = buildBlocks(inner);
      state.warnings.push(...nested.warnings);
      pushBlock(state, listStack, { type: 'blockquote', blocks: nested.blocks });
      i += 1;
      continue;
    }

    /* ---------------- القوائم ---------------- */
    if (token.type === 'bullet_list_open' || token.type === 'ordered_list_open') {
      const isOrdered = token.type === 'ordered_list_open';
      const start = Number(token.attrGet('start') || 1);
      const list = {
        type: 'list',
        ordered: isOrdered,
        start,
        depth: listStack.length,
        items: []
      };
      listStack.push(list);
      i += 1;
      continue;
    }

    if (token.type === 'bullet_list_close' || token.type === 'ordered_list_close') {
      const list = listStack.pop();
      if (list) {
        if (list.depth === 0) state.blocks.push(list);
        else attachToList(listStack, list);
      }
      i += 1;
      continue;
    }

    if (token.type === 'list_item_open') {
      const current = listStack[listStack.length - 1];
      if (current) {
        current.items.push({ blocks: [] });
      }
      i += 1;
      continue;
    }

    if (token.type === 'list_item_close') {
      i += 1;
      continue;
    }

    /* ---------------- الفاصل الأفقي ---------------- */
    if (token.type === 'hr') {
      pushBlock(state, listStack, { type: 'hr' });
      i += 1;
      continue;
    }

    /* ---------------- الجداول ---------------- */
    if (token.type === 'table_open') {
      const table = { type: 'table', header: [], rows: [], align: [] };
      i += 1;
      let inHeader = false;
      let inBody = false;
      while (i < tokens.length && tokens[i].type !== 'table_close') {
        const t = tokens[i];
        if (t.type === 'thead_open') inHeader = true;
        if (t.type === 'thead_close') inHeader = false;
        if (t.type === 'tbody_open') inBody = true;
        if (t.type === 'tbody_close') inBody = false;
        if (t.type === 'tr_open') {
          table.rows.push({ cells: [], header: inHeader });
        }
        if (t.type === 'th_open' || t.type === 'td_open') {
          const inline = tokens[i + 1];
          const children = inline && inline.type === 'inline' ? inline.children || [] : [];
          const row = table.rows[table.rows.length - 1];
          if (row) {
            row.cells.push({
              inline: buildInline(children, state),
              align: t.attrGet('style') || ''
            });
          }
          i = skipTo(tokens, i, t.type === 'th_open' ? 'th_close' : 'td_close');
          continue;
        }
        i += 1;
      }
      // الصف الأول في thead هو الرأس
      const headerRow = table.rows.find((r) => r.header);
      table.header = headerRow ? headerRow.cells : [];
      table.rows = table.rows.filter((r) => !r.header);
      void inBody;
      pushBlock(state, listStack, table);
      i += 1;
      continue;
    }

    /* ---------------- HTML خام ---------------- */
    if (token.type === 'html_block' || token.type === 'html_inline') {
      // html:false يمنع التفسير، لكن markdown-it يمررها كتوكن؛ نخزنها كنص حرفي.
      const raw = token.content || token.raw || '';
      if (raw.trim()) {
        state.warnings.push('RAW_HTML_SHOWN_AS_TEXT');
        pushBlock(state, listStack, {
          type: 'paragraph',
          children: [{ type: 'text', text: raw.trim(), marks: [] }]
        });
      }
      i += 1;
      continue;
    }

    i += 1;
  }

  return { blocks: state.blocks, warnings: state.warnings };
}

/** يبحث عن توكن الإغلاق ويُعيد الفهرس التالي. */
function skipTo(tokens, from, closeType) {
  for (let j = from + 1; j < tokens.length; j += 1) {
    if (tokens[j].type === closeType) return j + 1;
  }
  return from + 1;
}

/** يرفق كتلة إلى آخر عنصر في آخر قائمة مفتوحة (لدعم القوائم المتداخلة). */
function attachToList(listStack, block) {
  if (listStack.length === 0) return;
  const list = listStack[listStack.length - 1];
  const item = list.items[list.items.length - 1];
  if (item) item.blocks.push(block);
}

/**
 * يضيف كتلة إلى الشجرة: إن كانت هناك قائمة مفتوحة تُرفق بالعنصر الحالي،
 * وإلا تُضاف إلى جذر المستند. (بدون هذه الدالة كانت بعض الكتل تُفقد صامتًا.)
 */
function pushBlock(state, listStack, block) {
  if (listStack.length > 0) {
    attachToList(listStack, block);
  } else {
    state.blocks.push(block);
  }
}

/* ------------------------------------------------------------------ */
/* التنسيقات داخل السطر                                                */
/* ------------------------------------------------------------------ */

/**
 * يحوّل children الخاصة بـ inline إلى قطع نصية بعلامات (marks).
 * @param {any[]} children
 * @param {{warnings:string[]}} state
 * @returns {import('./types.js').InlineNode[]}
 */
function buildInline(children, state) {
  const out = [];
  let activeLink = null;
  const stack = []; // { mark, closer }

  const pushText = (text) => {
    if (!text) return;
    if (LOOKS_LIKE_HTML_TAG.test(text)) {
      state.warnings.push('RAW_HTML_SHOWN_AS_TEXT');
    }
    const marks = stack.filter((m) => m.mark).map((m) => m.mark);
    if (activeLink) marks.push(activeLink);
    out.push({ type: 'text', text, marks: dedupeMarks(marks) });
  };

  for (let i = 0; i < children.length; i += 1) {
    const t = children[i];

    switch (t.type) {
      case 'text':
        pushText(t.content);
        break;

      case 'code_inline':
        pushTextWithExtraMark(out, t.content, stack, activeLink, { type: 'code' });
        break;

      case 'strong_open':
        stack.push({ mark: { type: 'bold' } });
        break;
      case 'strong_close':
        stack.pop();
        break;

      case 'em_open':
        stack.push({ mark: { type: 'italic' } });
        break;
      case 'em_close':
        stack.pop();
        break;

      case 's_open':
        stack.push({ mark: { type: 'strike' } });
        break;
      case 's_close':
        stack.pop();
        break;

      case 'link_open': {
        const raw = t.attrGet('href') || '';
        const safe = sanitizeLink(raw);
        if (safe) {
          activeLink = { type: 'link', href: safe };
        } else {
          state.warnings.push('UNSAFE_LINK_AS_TEXT');
          activeLink = null;
          // نحتفظ بالنص فقط
        }
        break;
      }
      case 'link_close':
        activeLink = null;
        break;

      case 'image': {
        state.warnings.push('IMAGE_AS_LINK');
        const alt = t.content || imageAltFromToken(t);
        const src = t.attrGet('src') || '';
        const safe = sanitizeLink(src);
        const text = safe ? `🖼 ${alt}` : `🖼 ${alt}`;
        const marks = safe ? [{ type: 'link', href: safe }] : [];
        out.push({ type: 'text', text, marks });
        break;
      }

      case 'softbreak':
        pushText('\n');
        break;
      case 'hardbreak':
        pushText('\n');
        break;

      case 'html_inline':
        state.warnings.push('RAW_HTML_SHOWN_AS_TEXT');
        pushText(t.content);
        break;

      case 'emoji':
        pushText(t.content);
        break;

      default:
        if (t.content) pushText(t.content);
        else if (t.children) out.push(...buildInline(t.children, state));
        break;
    }
  }

  return mergeAdjacent(out);
}

function imageAltFromToken() {
  return 'صورة';
}

/**
 * يضيف قطعة نصية تحمل علامة إضافية (مثل code) فوق العلامات النشطة.
 */
function pushTextWithExtraMark(out, text, stack, activeLink, extraMark) {
  if (!text) return;
  const marks = stack.filter((m) => m.mark).map((m) => m.mark);
  if (activeLink) marks.push(activeLink);
  marks.push(extraMark);
  out.push({ type: 'text', text, marks: dedupeMarks(marks) });
}

function dedupeMarks(marks) {
  const seen = new Set();
  const out = [];
  for (const m of marks) {
    const key = m.type === 'link' ? `link:${m.href}` : m.type;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(m);
  }
  return out;
}

/** يدمج القطع المتجاورة التي تحمل نفس العلامات (اختصار للمخرجات). */
function mergeAdjacent(nodes) {
  const out = [];
  for (const node of nodes) {
    const prev = out[out.length - 1];
    if (
      prev &&
      prev.type === 'text' &&
      node.type === 'text' &&
      sameMarks(prev.marks, node.marks)
    ) {
      prev.text += node.text;
    } else {
      out.push({ ...node, marks: node.marks ? [...node.marks] : [] });
    }
  }
  return out;
}

function sameMarks(a = [], b = []) {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i += 1) {
    if (a[i].type !== b[i].type) return false;
    if (a[i].type === 'link' && a[i].href !== b[i].href) return false;
  }
  return true;
}

/** يستورد sanitizeUrl لتجنب دورات الاستيراد. */
import { sanitizeUrl } from './escape.js';

function sanitizeLink(raw) {
  return sanitizeUrl(raw);
}
