import { describe, it, expect } from 'vitest';
import { renderToTelegram, TELEGRAM_HARD_LIMIT, splitIntoChunks, utf16Length } from '../src/index.js';

/**
 * اختبارات متانة: نتحقق أن المحرك لا ينهار على مدخلات غريبة،
 * وأن أي مخرج يبقى صالحًا لتلجرام (الطول، الكيانات، عدم فقدان النص).
 */

function assertValidOutput(result) {
  for (const message of result.messages) {
    expect(message.length).toBeLessThanOrEqual(TELEGRAM_HARD_LIMIT);
    expect(message.length).toBe(message.text.length);
    expect(message.entities.length).toBeLessThanOrEqual(100);
    for (const entity of message.entities) {
      expect(entity.offset).toBeGreaterThanOrEqual(0);
      expect(entity.offset + entity.length).toBeLessThanOrEqual(message.text.length);
    }
    // HTML صحيح: العدد متوازن للوسوم المدعومة
    for (const tag of ['b', 'i', 's', 'u', 'code', 'pre', 'blockquote', 'tg-spoiler', 'a']) {
      const open = (message.html.match(new RegExp(`<${tag}(\\s|>)`, 'g')) || []).length;
      const close = (message.html.match(new RegExp(`</${tag}>`, 'g')) || []).length;
      expect(open).toBe(close);
    }
  }
}

describe('متانة المحرك', () => {
  const samples = {
    'نص عربي طويل بلا مسافات': 'ا'.repeat(9000),
    'كلمة إنجليزية طويلة': 'a'.repeat(12000),
    'إيموجي متكرر': '😀🎉👍'.repeat(3000),
    'تعشيش عميق': '> '.repeat(20) + 'نص',
    'قوائم عميقة': Array.from({ length: 30 }, (_, i) => '  '.repeat(i % 6) + `- عنصر ${i}`).join('\n'),
    'رموز ماركداون': '** __ ~~ ` ### --- ||| []()'.repeat(500),
    'جداول متعددة': Array.from({ length: 20 }, () => '| a | b |\n|---|---|\n| 1 | 2 |').join('\n\n'),
    'أسطر فارغة كثيرة': 'نص' + '\n\n'.repeat(500) + 'نص',
    'خلط RTL/LTR': 'عربي english عربي 123 عربي `code` عربي'.repeat(400),
    'بريد وروابط': 'a@b.com https://example.com/x '.repeat(600)
  };

  for (const [name, markdown] of Object.entries(samples)) {
    it(`لا ينهار ويخرج مخرجات صالحة: ${name}`, () => {
      const result = renderToTelegram(markdown, { maxMessages: 400 });
      assertValidOutput(result);
      expect(result.stats.withinHardLimit).toBe(true);
    });
  }

  it('يحافظ على مجموع الأحرف للمحتوى الطويل (لا حذف)', () => {
    const md = 'كلمة '.repeat(4000).trim();
    const result = renderToTelegram(md);
    const totalOut = result.messages.map((m) => m.text).join('').replace(/\s/g, '');
    expect(totalOut).toBe(md.replace(/\s/g, ''));
  });

  it('utf16Length يطابق سلوك تلجرام للإيموجي', () => {
    expect(utf16Length('😀')).toBe(2);
    expect(utf16Length('ab')).toBe(2);
    expect(utf16Length('مرحبا')).toBe(5);
  });

  it('splitIntoChunks تحترم الحد المفضل (3072) افتراضيًا', () => {
    const md = 'فقرة '.repeat(2000);
    const result = renderToTelegram(md);
    for (const message of result.messages) {
      expect(message.length).toBeLessThanOrEqual(3072);
    }
  });

  it('يدعم softLimit مخصصًا', () => {
    const result = renderToTelegram('كلمة '.repeat(500), { softLimit: 300 });
    expect(result.messages.length).toBeGreaterThan(5);
    for (const message of result.messages) {
      expect(message.length).toBeLessThanOrEqual(300);
    }
  });

  it('يحافظ على الكيانات عند تقسيم نص طويل منسّق', () => {
    const md = ('**عريض** و *مائل* و `كود` و [رابط](https://a.b) و~~مشطوب~~. ').repeat(200);
    const result = renderToTelegram(md, { maxMessages: 400 });
    expect(result.messages.length).toBeGreaterThan(1);
    assertValidOutput(result);
  });

  it('لا ينتج رسائل فارغة', () => {
    const result = renderToTelegram('\n\n\n   \n\n');
    expect(result.messages.length).toBe(0);
  });

  it('يتعامل مع محتوى أحادي الحرف', () => {
    const result = renderToTelegram('ا');
    expect(result.messages).toHaveLength(1);
    expect(result.messages[0].text).toBe('ا');
  });

  it('يرفض رسالة واحدة أطول من الحد القسري للمحرك عند طلب صريح', () => {
    const result = renderToTelegram('كلمة '.repeat(1000), { softLimit: 4000 });
    expect(result.stats.withinHardLimit).toBe(true);
  });

  it('splitIntoChunks تصدّر دالة مستقلة صالحة للاستخدام', () => {
    expect(typeof splitIntoChunks).toBe('function');
  });
});

describe('مطابقة المعاينة للنشر (نفس المحرك)', () => {
  it('تشغيل المحرك مرتين على نفس المدخل يعطي نفس النتيجة (حتمية)', () => {
    const md = '# عنوان\n\n**عريض** و *مائل*\n\n- عنصر\n- عنصر آخر';
    const a = renderToTelegram(md);
    const b = renderToTelegram(md);
    expect(a.messages).toEqual(b.messages);
    expect(a.stats).toEqual(b.stats);
    expect(a.warnings.map((w) => w.code)).toEqual(b.warnings.map((w) => w.code));
  });
});
