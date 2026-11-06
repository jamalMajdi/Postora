import { describe, it, expect } from 'vitest';
import {
  renderPreview,
  entitiesToPreviewHtml,
  fingerprintPreview,
  firstPreviewableLink
} from '../src/lib/markdown.js';
import { isMarkdownFile, isTooLarge, MAX_IMPORT_BYTES } from '../src/lib/fileImport.js';
import { renderToTelegram } from '@postora/markdown-engine';

/* ============================================================ */
/* 1) التطابق مع محرك الخادم                                     */
/* ============================================================ */

const SAMPLES = {
  'نص قصير': 'مرحبًا بالعالم',
  'عناوين': '# عنوان أول\n## عنوان ثان\n### عنوان ثالث',
  'تنسيقات': '**عريض** و *مائل* و ~~مشطوب~~ و `كود`',
  'قائمة غير مرقمة': '- أول\n- ثانٍ\n  - متداخل',
  'قائمة مرقمة': '1. واحد\n2. اثنان\n3. ثلاثة',
  'اقتباس': '> اقتباس هنا\n> سطر ثانٍ',
  'روابط': '[رابط نصي](https://example.com) و https://auto.link',
  'صورة': '![وصف الصورة](https://example.com/p.png)',
  'كود': '```js\nconst x = 1;\nconsole.log(x);\n```',
  'كود بلا لغة': '```\nplain\n```',
  'فاصل': 'قبل\n\n---\n\nبعد',
  'جدول': '| أ | ب |\n|---|---|\n| 1 | 2 |',
  'مختلط': '# عنوان\n**عريض** و *مائل*\n- عنصر\n> اقتباس\n[رابط](https://x.com)',
  'إنجليزي': '# Title\n**bold** and *italic*\n- item',
  'HTML خام': '<script>alert(1)</script>',
  'رموز': '5 < 10 && 3 > 2 "quoted"'
};

describe('تطابق المعاينة مع محرك الخادم', () => {
  it.each(Object.entries(SAMPLES))('%s — نفس البصمة تمامًا', (_name, markdown) => {
    const client = renderPreview(markdown);
    const server = renderToTelegram(markdown, { maxMessages: 40 });
    expect(fingerprintPreview(client)).toBe(fingerprintPreview(server));
    expect(client.stats.messagesCount).toBe(server.stats.messagesCount);
  });

  it('لا تعيد المحاكات نصوصًا مختلفة عند التقسيم الطويل', () => {
    const long = Array.from({ length: 60 }, (_, i) => `## قسم ${i + 1}\n\nمحتوى تجريبي طويل رقم ${i + 1}.`).join('\n\n');
    const client = renderPreview(long);
    const server = renderToTelegram(long, { maxMessages: 40 });
    expect(client.messages.length).toBeGreaterThan(1);
    expect(fingerprintPreview(client)).toBe(fingerprintPreview(server));
  });
});

/* ============================================================ */
/* 2) التقسيم إلى رسائل متعددة                                   */
/* ============================================================ */

describe('تقسيم المنشورات الطويلة', () => {
  it('ينتج 40 رسالة كحد أقصى ويحذر عند التجاوز', () => {
    const huge = 'كلمة '.repeat(60000);
    const result = renderPreview(huge);
    expect(result.error).toBe('TOO_MANY_MESSAGES');
    expect(result.messages).toHaveLength(0);
  });

  it('كل رسالة لا تتجاوز 4096 محرفًا', () => {
    const long = 'فقرة نصية للتجربة. '.repeat(2000);
    const result = renderPreview(long);
    for (const message of result.messages) {
      expect(message.length).toBeLessThanOrEqual(4096);
    }
  });

  it('ترتيب الرسائل تصاعدي ومحتواها غير مكرر', () => {
    const long = Array.from({ length: 80 }, (_, i) => `فقرة رقم ${i}.`).join('\n\n');
    const result = renderPreview(long);
    expect(result.messages.length).toBeGreaterThan(1);
    const firsts = result.messages.map((m) => m.text.slice(0, 12));
    expect(new Set(firsts).size).toBe(firsts.length);
  });

  it('لا كيانات تتجاوز حدود النص في أي رسالة', () => {
    const long = Array.from({ length: 50 }, (_, i) => `**عريض ${i}** و *مائل ${i}*`).join('\n\n');
    const result = renderPreview(long);
    for (const message of result.messages) {
      for (const entity of message.entities) {
        expect(entity.offset).toBeGreaterThanOrEqual(0);
        expect(entity.offset + entity.length).toBeLessThanOrEqual(message.text.length);
      }
      expect(message.entities.length).toBeLessThanOrEqual(100);
    }
  });
});

/* ============================================================ */
/* 3) أمان HTML المعاينة                                         */
/* ============================================================ */

describe('أمان HTML المعاينة', () => {
  it('يهرّب كل وسوم HTML الخطرة', () => {
    const html = entitiesToPreviewHtml('<script>alert(1)</script>', []);
    expect(html).not.toContain('<script>');
    expect(html).toContain('&lt;script&gt;');
  });

  it('يهرّب علامات الاقتباس والشرطة المائلة', () => {
    const html = entitiesToPreviewHtml('a "b" & <c>', []);
    expect(html).toContain('&quot;');
    expect(html).toContain('&amp;');
    expect(html).not.toContain('<c>');
  });

  it('يهرّب عنوان الرابط قبل حقنه في href', () => {
    const html = entitiesToPreviewHtml('اضغط', [
      { type: 'text_link', offset: 0, length: 5, url: 'https://x.com/?a="><script>' }
    ]);
    expect(html).not.toContain('"><script>');
    expect(html).toContain('&quot;&gt;&lt;script&gt;');
  });

  it('يولّد وسوم تلجرام الصحيحة للتنسيقات', () => {
    const html = entitiesToPreviewHtml('عريض', [{ type: 'bold', offset: 0, length: 4 }]);
    expect(html).toBe('<b>عريض</b>');
  });

  it('يغلق الوسوم المتداخلة بترتيب صحيح', () => {
    const html = entitiesToPreviewHtml('نص', [
      { type: 'bold', offset: 0, length: 2 },
      { type: 'italic', offset: 0, length: 2 }
    ]);
    // فتح: b ثم i — إغلاق: i ثم b
    expect(html.indexOf('<b>')).toBeLessThan(html.indexOf('<i>'));
    expect(html.lastIndexOf('</i>')).toBeLessThan(html.lastIndexOf('</b>'));
  });

  it('يطابق اصطلاح تلجرام لكتلة الكود (pre > code + language-*)', () => {
    const withLang = entitiesToPreviewHtml('const x = 1;', [
      { type: 'pre', offset: 0, length: 12, language: 'js' }
    ]);
    expect(withLang).toContain('<pre><code class="language-js">');
    expect(withLang).toContain('</code></pre>');

    // بلا لغة: <pre> مجرّدة — نفس اصطلاح المحرك حرفيًا
    const noLang = entitiesToPreviewHtml('plain', [{ type: 'pre', offset: 0, length: 5 }]);
    expect(noLang).toBe('<pre>plain</pre>');
    expect(noLang).not.toContain('language-');
  });

  it('بنية HTML للمعاينة تطابق بنية المحرك في كل العينات', () => {
    const tags = (h) => (h.match(/<\/?(b|i|s|code|pre|a)\b/g) || []).sort().join(',');
    for (const md of Object.values(SAMPLES)) {
      const result = renderPreview(md);
      for (const message of result.messages) {
        expect(tags(entitiesToPreviewHtml(message.text, message.entities))).toBe(tags(message.html));
      }
    }
  });

  it('يرسم الاقتباس ككيان كتلة', () => {
    const html = entitiesToPreviewHtml('اقتباس', [
      { type: 'blockquote', offset: 0, length: 6 }
    ]);
    expect(html).toContain('tg-quote');
  });
});

/* ============================================================ */
/* 4) اكتشاف معاينة الرابط (تلجرام يعطّلها)                       */
/* ============================================================ */

describe('كشف معاينة الرابط', () => {
  it('يجد رابطًا ويحدد نوعه', () => {
    expect(firstPreviewableLink([{ type: 'text_link', url: 'https://a.com' }])).toEqual({
      url: 'https://a.com',
      kind: 'link'
    });
  });

  it('يميّز روابط الصور', () => {
    expect(firstPreviewableLink([{ type: 'text_link', url: 'https://a.com/p.jpg' }])?.kind).toBe('image');
  });

  it('يعيد null عند غياب الروابط', () => {
    expect(firstPreviewableLink([{ type: 'bold', offset: 0, length: 3 }])).toBeNull();
  });
});

/* ============================================================ */
/* 5) استيراد ملف .md                                            */
/* ============================================================ */

describe('استيراد ملف Markdown', () => {
  it('يقبل الامتدادات النصية المعروفة', () => {
    for (const name of ['a.md', 'b.markdown', 'c.txt', 'd.MD']) {
      expect(isMarkdownFile({ name, type: '', size: 10 })).toBe(true);
    }
  });

  it('يرفض الأنواع غير المسموحة', () => {
    expect(isMarkdownFile({ name: 'x.html', type: 'text/html', size: 10 })).toBe(false);
    expect(isMarkdownFile({ name: 'y.png', type: 'image/png', size: 10 })).toBe(false);
    expect(isMarkdownFile(null)).toBe(false);
  });

  it('يرفض الملفات الأكبر من الحد', () => {
    expect(isTooLarge({ size: MAX_IMPORT_BYTES + 1 })).toBe(true);
    expect(isTooLarge({ size: MAX_IMPORT_BYTES })).toBe(false);
  });
});

/* ============================================================ */
/* 6) الحالات الحدّية                                             */
/* ============================================================ */

describe('الحالات الحدّية', () => {
  it('النص الفارغ يعيد معاينة فارغة بلا أخطاء', () => {
    const result = renderPreview('');
    expect(result.messages).toHaveLength(0);
    expect(result.error).toBeUndefined();
  });

  it('المسافات فقط تُعدّ فارغة', () => {
    expect(renderPreview('   \n\n  ').messages).toHaveLength(0);
  });

  it('لا ينهار على محارف تحكم أو يسار-يمين', () => {
    const result = renderPreview('نص \u200f عربي \u202e مقلوب');
    expect(result.error).toBeUndefined();
    expect(result.messages.length).toBe(1);
  });
});
