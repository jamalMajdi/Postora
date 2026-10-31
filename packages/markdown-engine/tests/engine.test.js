import { describe, it, expect } from 'vitest';
import {
  renderToTelegram,
  toPlainText,
  TELEGRAM_HARD_LIMIT,
  WarningCode
} from '../src/index.js';

/** يجمع نص كل الرسائل — لاستخدامه في التحقق من عدم فقدان المحتوى. */
const allText = (result) => result.messages.map((m) => m.text).join('\n\n');

describe('تحويل التنسيقات الأساسية', () => {
  it('يحوّل العريض والمائل والمشطوب والكود إلى كيانات صحيحة', () => {
    const result = renderToTelegram('**bold** و *italic* و ~~strike~~ و `code`');
    const [message] = result.messages;
    expect(message.text).toBe('bold و italic و strike و code');

    const types = message.entities.map((e) => e.type).sort();
    expect(types).toEqual(['bold', 'code', 'italic', 'strikethrough']);

    const bold = message.entities.find((e) => e.type === 'bold');
    expect(bold).toMatchObject({ offset: 0, length: 4 });

    const italic = message.entities.find((e) => e.type === 'italic');
    expect(message.text.slice(italic.offset, italic.offset + italic.length)).toBe('italic');

    expect(message.html).toContain('<b>bold</b>');
    expect(message.html).toContain('<i>italic</i>');
    expect(message.html).toContain('<s>strike</s>');
    expect(message.html).toContain('<code>code</code>');
  });

  it('يدعم تداخل التنسيقات (عريض يحتوي مائل)', () => {
    const result = renderToTelegram('**عريض *مائل* عريض**');
    const [message] = result.messages;
    expect(message.text).toBe('عريض مائل عريض');
    const bold = message.entities.find((e) => e.type === 'bold');
    const italic = message.entities.find((e) => e.type === 'italic');
    expect(bold).toMatchObject({ offset: 0, length: message.text.length });
    expect(message.text.slice(italic.offset, italic.offset + italic.length)).toBe('مائل');
    // التداخل صحيح في HTML
    expect(message.html).toBe('<b>عريض <i>مائل</i> عريض</b>');
  });

  it('يحوّل الروابط إلى كيانات text_link', () => {
    const result = renderToTelegram('زيارة [الموقع](https://example.com/page) الآن');
    const [message] = result.messages;
    const link = message.entities.find((e) => e.type === 'text_link');
    expect(link.url).toBe('https://example.com/page');
    expect(message.text.slice(link.offset, link.offset + link.length)).toBe('الموقع');
  });

  it('لا يحوّل روابط javascript: إلى كيانات رابط', () => {
    const result = renderToTelegram('[اضغط](javascript:alert(1))');
    const [message] = result.messages;
    expect(message.entities.some((e) => e.type === 'text_link')).toBe(false);
    expect(message.html).not.toContain('href');
  });

  it('يعرض الروابط بمخطط غير مسموح كنص فقط ويحذّر', () => {
    const result = renderToTelegram('[ملف](ftp://example.com/file.txt)');
    const [message] = result.messages;
    expect(message.entities.some((e) => e.type === 'text_link')).toBe(false);
    expect(result.warnings.map((w) => w.code)).toContain(WarningCode.UNSAFE_LINK_AS_TEXT);
  });

  it('يحوّل عنوان المستوى الأول والثاني إلى سطر عريض مع تحذير', () => {
    const result = renderToTelegram('# عنوان\n\n## عنوان فرعي');
    expect(allText(result)).toBe('عنوان\n\nعنوان فرعي');
    expect(result.warnings.map((w) => w.code)).toContain(WarningCode.HEADING_AS_BOLD);
    expect(result.messages[0].entities[0].type).toBe('bold');
  });

  it('يحوّل الاقتباس إلى كيان blockquote', () => {
    const result = renderToTelegram('> اقتباس\n> سطر ثانٍ');
    const [message] = result.messages;
    expect(message.text).toBe('اقتباس\nسطر ثانٍ');
    const quote = message.entities.find((e) => e.type === 'blockquote');
    expect(quote).toBeDefined();
  });

  it('يحوّل كتل الكود مع اسم اللغة', () => {
    const result = renderToTelegram('```js\nconst a = 1;\n```');
    const [message] = result.messages;
    expect(message.text).toBe('const a = 1;');
    const pre = message.entities.find((e) => e.type === 'pre');
    expect(pre.language).toBe('js');
    expect(message.html).toBe('<pre><code class="language-js">const a = 1;</code></pre>');
  });

  it('لا يفسّر الكود كتنسيق (markdown داخل الكود يبقى حرفيًا)', () => {
    const result = renderToTelegram('`**not bold**`');
    const [message] = result.messages;
    expect(message.text).toBe('**not bold**');
    expect(message.entities).toHaveLength(1);
    expect(message.entities[0].type).toBe('code');
  });

  it('يحوّل الفاصل الأفقي إلى سطر رموز', () => {
    const result = renderToTelegram('نص\n\n---\n\nنص آخر');
    expect(allText(result)).toContain('──────────');
    expect(result.warnings.map((w) => w.code)).toContain(WarningCode.HR_AS_TEXT);
  });
});

describe('القوائم', () => {
  it('يحوّل القائمة غير المرتبة إلى رموز •', () => {
    const result = renderToTelegram('- أول\n- ثاني\n- ثالث');
    expect(result.messages[0].text).toBe('• أول\n• ثاني\n• ثالث');
    expect(result.warnings.map((w) => w.code)).toContain(WarningCode.LIST_AS_TEXT);
  });

  it('يحافظ على الترقيم في القوائم المرتبة ويبدأ من البداية المحددة', () => {
    const result = renderToTelegram('1. واحد\n2. اثنان');
    expect(result.messages[0].text).toBe('1. واحد\n2. اثنان');

    const startAt3 = renderToTelegram('3. ثلاثة\n4. أربعة');
    expect(startAt3.messages[0].text).toBe('3. ثلاثة\n4. أربعة');
  });

  it('يُظهر القوائم المتداخلة بمسافات بادئة', () => {
    const result = renderToTelegram('- أ\n  - ب\n    - ج');
    expect(result.messages[0].text).toBe('• أ\n  • ب\n    • ج');
    expect(result.warnings.map((w) => w.code)).toContain(WarningCode.NESTED_LIST_AS_TEXT);
  });
});

describe('التنسيقات غير المدعومة تُعالج بوضوح', () => {
  it('يحوّل الجدول إلى كتلة نصية ويحذّر', () => {
    const result = renderToTelegram('| الاسم | العمر |\n|---|---|\n| علي | 30 |');
    const [message] = result.messages;
    expect(message.text).toContain('الاسم');
    expect(message.text).toContain('علي');
    expect(message.entities[0].type).toBe('pre');
    expect(result.warnings.map((w) => w.code)).toContain(WarningCode.TABLE_AS_MONOSPACE);
  });

  it('يحوّل الصورة إلى نص بديل مع تحذير', () => {
    const result = renderToTelegram('![شعار](https://example.com/logo.png)');
    expect(result.messages[0].text).toBe('🖼 شعار');
    expect(result.warnings.map((w) => w.code)).toContain(WarningCode.IMAGE_AS_LINK);
  });

  it('لا ينفّذ HTML خامًا ويظهره كنص مهروب', () => {
    const result = renderToTelegram('مرحبًا <script>alert("x")</script>');
    const [message] = result.messages;
    expect(message.text).toContain('<script>');
    expect(message.html).toContain('&lt;script&gt;');
    expect(message.html).not.toContain('<script>');
    expect(result.warnings.map((w) => w.code)).toContain(WarningCode.RAW_HTML_SHOWN_AS_TEXT);
  });

  it('يهرّب محارف HTML الخاصة دون إفساد النص', () => {
    const result = renderToTelegram('5 < 10 و 10 > 5 و A & B');
    expect(result.messages[0].text).toBe('5 < 10 و 10 > 5 و A & B');
    expect(result.messages[0].html).toBe('5 &lt; 10 و 10 &gt; 5 و A &amp; B');
  });
});

describe('العربية والرموز الخاصة', () => {
  it('يحافظ على النص العربي والتشكيل والإزاحات', () => {
    const md = 'بِسْمِ اللهِ **الرحمنِ** الرحيمِ';
    const result = renderToTelegram(md);
    const [message] = result.messages;
    expect(message.text).toBe('بِسْمِ اللهِ الرحمنِ الرحيمِ');
    const bold = message.entities[0];
    expect(message.text.slice(bold.offset, bold.offset + bold.length)).toBe('الرحمنِ');
  });

  it('يحافظ على النص المختلط (عربي/إنجليزي/رموز/بريد)', () => {
    const md = 'اسمي Ali، بريدي a@b.com، والرابط https://x.dev — شكرًا!';
    const result = renderToTelegram(md);
    expect(result.messages[0].text).toContain('Ali');
    expect(result.messages[0].text).toContain('a@b.com');
  });

  it('يحافظ على الرموز التي قد تُفسَّر كتنسيق', () => {
    const md = 'السعر 2 * 3 = 6 و 4 _ 2 = 2 و [قوس] و (قوس) و # وربي';
    const result = renderToTelegram(md);
    expect(result.messages[0].text).toContain('2 * 3 = 6');
    expect(result.messages[0].text).toContain('[قوس]');
  });

  it('لا يكسر زوج الـ surrogate في الإيموجي داخل التقسيم', () => {
    const emoji = '😀';
    const md = emoji.repeat(50);
    const result = renderToTelegram(md);
    expect(allText(result).replace(/\n/g, '')).toBe(emoji.repeat(50));
  });
});

describe('حدود طول الرسائل والقياس بعد التحويل', () => {
  it('يقيس الطول بعد التحويل لا طول Markdown الخام', () => {
    const raw = '**' + 'ا'.repeat(100) + '**';
    const result = renderToTelegram(raw);
    // الطول الخام 104، والنهائي 100 فقط
    expect(raw.length).toBe(104);
    expect(result.stats.totalChars).toBe(100);
    expect(result.stats.messagesCount).toBe(1);
  });

  it('يقدّم التقسيم على الحد المفضل قبل الحد الصارم', () => {
    const paragraph = 'كلمة '.repeat(900); // ~4500 محرف
    const result = renderToTelegram(paragraph);
    expect(result.messages.length).toBeGreaterThan(1);
    for (const message of result.messages) {
      expect(message.length).toBeLessThanOrEqual(TELEGRAM_HARD_LIMIT);
    }
    expect(result.warnings.map((w) => w.code)).toContain(WarningCode.MESSAGE_SPLIT);
  });

  it('لا يحذف أي محتوى عند التقسيم (تحقق من اتحاد الأحرف)', () => {
    const words = Array.from({ length: 2000 }, (_, i) => `كلمة${i}`).join(' ');
    const result = renderToTelegram(words);
    expect(result.messages.length).toBeGreaterThan(1);

    const joined = result.messages.map((m) => m.text).join(' ').replace(/\s+/g, ' ');
    expect(joined.replace(/\s+/g, '')).toBe(words.replace(/\s+/g, ''));
  });

  it('يقسم كتلة كود أطول من الحد ويعيد فتح <pre> في كل جزء', () => {
    const lines = Array.from({ length: 400 }, (_, i) => `console.log("line ${i}");`).join('\n');
    const result = renderToTelegram('```js\n' + lines + '\n```');
    expect(result.messages.length).toBeGreaterThan(1);
    for (const message of result.messages) {
      expect(message.length).toBeLessThanOrEqual(TELEGRAM_HARD_LIMIT);
      expect(message.entities.some((e) => e.type === 'pre')).toBe(true);
    }
    expect(result.warnings.map((w) => w.code)).toContain(WarningCode.CODE_BLOCK_SPLIT);
    const joined = result.messages.map((m) => m.text).join('\n');
    expect(joined.replace(/\s+/g, '')).toBe(lines.replace(/\s+/g, ''));
  });

  it('يحافظ على صحة الكيانات (offset + length) بعد التقسيم', () => {
    const md = Array.from({ length: 300 }, (_, i) => `**عريض ${i}** و *مائل ${i}*`).join('\n\n');
    const result = renderToTelegram(md);
    expect(result.messages.length).toBeGreaterThan(1);
    for (const message of result.messages) {
      for (const entity of message.entities) {
        expect(entity.offset).toBeGreaterThanOrEqual(0);
        expect(entity.offset + entity.length).toBeLessThanOrEqual(message.text.length);
        expect(entity.length).toBeGreaterThan(0);
      }
    }
  });

  it('يرفض محتوى يتطلب رسائل أكثر من الحد المسموح', () => {
    const huge = 'سطر طويل جدًا هنا. '.repeat(3000);
    expect(() => renderToTelegram(huge, { maxMessages: 3 })).toThrowError(/TOO_MANY_MESSAGES|too long/);
  });

  it('يعيد إحصاءات متسقة', () => {
    const result = renderToTelegram('abc\n\ndef');
    expect(result.stats.messagesCount).toBe(1);
    expect(result.stats.totalChars).toBe(8);
    expect(result.stats.withinHardLimit).toBe(true);
    expect(result.truncated).toBe(false);
  });
});

describe('واجهات مساعدة', () => {
  it('toPlainText يعيد النص الظاهر فقط', () => {
    expect(toPlainText('# عنوان\n\nنص **عريض**')).toBe('عنوان\n\nنص عريض');
  });

  it('يتعامل مع محتوى فارغ دون انهيار', () => {
    const result = renderToTelegram('');
    expect(result.messages).toEqual([]);
    expect(result.stats.messagesCount).toBe(0);
  });
});
