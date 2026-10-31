import { describe, it, expect } from 'vitest';
import { contentFingerprint, sha256Hex, randomKey, safeEqual } from '../../src/utils/crypto.js';
import { extractTitle, validateDocumentMetadata, decodeMarkdownBuffer } from '../../src/files/markdownFile.js';
import { normalizeTelegramError } from '../../src/telegram/errors.js';
import { TelegramRateLimiter, backoffDelay } from '../../src/telegram/rateLimiter.js';
import { renderMarkdown } from '../../src/services/renderService.js';

const LIMITS = { maxBytes: 262144, maxChars: 100000, maxMessages: 40 };

describe('crypto utils', () => {
  it('بصمة المحتوى تتجاهل فروق الهوامش الطرفية', () => {
    const a = contentFingerprint('# عنوان\n\nنص');
    const b = contentFingerprint('# عنوان  \n\n\nنص\n');
    expect(a).toBe(b);
  });

  it('بصمة المحتوى تختلف عند تغيّر محرف واحد', () => {
    expect(contentFingerprint('نص أ')).not.toBe(contentFingerprint('نص ب'));
  });

  it('sha256 يعيد 64 محرفًا سداسيًا', () => {
    expect(sha256Hex('x')).toHaveLength(64);
  });

  it('randomKey يعيد مفاتيح مختلفة', () => {
    expect(randomKey()).not.toBe(randomKey());
  });

  it('safeEqual يقارن بأمان', () => {
    expect(safeEqual('abc', 'abc')).toBe(true);
    expect(safeEqual('abc', 'abd')).toBe(false);
    expect(safeEqual('abc', 'abcd')).toBe(false);
  });
});

describe('ملفات Markdown', () => {
  it('يقبل .md و.markdown', () => {
    expect(validateDocumentMetadata({ file_name: 'a.md' }, LIMITS).extension).toBe('.md');
    expect(validateDocumentMetadata({ file_name: 'a.MARKDOWN' }, LIMITS).extension).toBe(
      '.markdown'
    );
  });

  it('يرفض امتدادًا غير مدعوم', () => {
    expect(() => validateDocumentMetadata({ file_name: 'a.txt' }, LIMITS)).toThrowError(
      /FILE_INVALID_EXTENSION/
    );
  });

  it('يرفض ملفًا يتجاوز الحد قبل التنزيل', () => {
    expect(() =>
      validateDocumentMetadata({ file_name: 'a.md', file_size: 999999 }, LIMITS)
    ).toThrowError(/FILE_TOO_LARGE/);
  });

  it('يفك ترميز UTF-8 ويحذف BOM', () => {
    const buffer = Buffer.from('\uFEFF# عنوان', 'utf8');
    expect(decodeMarkdownBuffer(buffer, LIMITS)).toBe('# عنوان');
  });

  it('يرفض ملفًا ثنائيًا', () => {
    expect(() => decodeMarkdownBuffer(Buffer.from([0, 1, 2, 0]), LIMITS)).toThrowError(
      /FILE_INVALID_ENCODING/
    );
  });

  it('يرفض ملفًا فارغًا', () => {
    expect(() => decodeMarkdownBuffer(Buffer.from('   '), LIMITS)).toThrowError(/FILE_EMPTY/);
  });

  it('يستخرج العنوان من أول عنوان Markdown', () => {
    expect(extractTitle('# عنواني\n\nنص')).toBe('عنواني');
  });

  it('يستخرج عنوانًا مقترحًا من أول سطر نصي', () => {
    expect(extractTitle('سطر أول عادي\nسطر ثانٍ')).toBe('سطر أول عادي');
  });
});

describe('ترميز أخطاء تلجرام', () => {
  it('يحوّل 429 إلى TELEGRAM_RATE_LIMITED مع retry_after', () => {
    const result = normalizeTelegramError({
      response: { error_code: 429, description: 'Too Many Requests', parameters: { retry_after: 7 } }
    });
    expect(result.code).toBe('TELEGRAM_RATE_LIMITED');
    expect(result.retryAfter).toBe(7);
  });

  it('يحوّل 403 إلى TELEGRAM_FORBIDDEN', () => {
    const result = normalizeTelegramError({
      response: { error_code: 403, description: 'Forbidden: bot is not a member' }
    });
    expect(result.code).toBe('TELEGRAM_FORBIDDEN');
  });

  it('يحوّل خطأ الكيانات إلى RENDER_FAILED', () => {
    const result = normalizeTelegramError({
      response: { error_code: 400, description: "Bad Request: can't parse entities" }
    });
    expect(result.code).toBe('RENDER_FAILED');
  });

  it('يحوّل chat not found إلى CHANNEL_NOT_FOUND', () => {
    const result = normalizeTelegramError({
      response: { error_code: 400, description: 'Bad Request: chat not found' }
    });
    expect(result.code).toBe('CHANNEL_NOT_FOUND');
  });
});

describe('حَدّ معدل البوابة', () => {
  it('يسمح بعدد محدود من النداءات داخل النافذة', async () => {
    let now = 1_000_000;
    const limiter = new TelegramRateLimiter({
      globalPerSecond: 3,
      perChatPerMinute: 100,
      now: () => now
    });

    await limiter.acquire('chat1');
    await limiter.acquire('chat1');
    await limiter.acquire('chat1');

    // النداء الرابع يجب أن ينتظر — نختبر بتحريك الساعة عبر setTimeout قصير
    const start = Date.now();
    const promise = limiter.acquire('chat1');
    setTimeout(() => {
      now += 1000; // نمرّر ثانية
    }, 60);
    await promise;
    expect(Date.now() - start).toBeGreaterThanOrEqual(50);
  });

  it('backoff يزيد مع المحاولات ويبقى داخل الحد', () => {
    for (let attempt = 1; attempt <= 6; attempt += 1) {
      const delay = backoffDelay(attempt, 100, 8000);
      expect(delay).toBeGreaterThan(0);
      expect(delay).toBeLessThanOrEqual(8000);
    }
  });
});

describe('renderService (غلاف الخادم حول المحرك)', () => {
  it('يحوّل Markdown ويعيد إحصاءات', () => {
    const result = renderMarkdown('# عنوان\n\n**عريض**', LIMITS);
    expect(result.messages.length).toBe(1);
    expect(result.stats.totalChars).toBeGreaterThan(0);
    expect(result.needsReview).toBe(false);
  });

  it('يرفض محتوى يتجاوز الحد الأقصى للمحارف', () => {
    const huge = 'a'.repeat(100001);
    expect(() => renderMarkdown(huge, LIMITS)).toThrowError(/CONTENT_TOO_LONG/);
  });

  it('يعلّم needsReview لوجود جدول', () => {
    const result = renderMarkdown('| a | b |\n|---|---|\n| 1 | 2 |', LIMITS);
    expect(result.needsReview).toBe(true);
  });

  it('يرفض محتوى يتطلب رسائل أكثر من الحد', () => {
    const huge = 'كلمة '.repeat(5000);
    expect(() => renderMarkdown(huge, { ...LIMITS, maxMessages: 2 })).toThrowError(
      /TOO_MANY_MESSAGES/
    );
  });
});
