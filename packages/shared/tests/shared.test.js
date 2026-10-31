import { describe, it, expect } from 'vitest';
import {
  ErrorCode,
  getUserMessage,
  ErrorMessagesAr,
  ErrorMessagesEn,
  channelConnectSchema,
  draftCreateSchema,
  publishSchema,
  previewSchema,
  TELEGRAM_MAX_MESSAGE_LENGTH,
  ALLOWED_MARKDOWN_EXTENSIONS
} from '../src/index.js';

describe('رموز الأخطاء والرسائل', () => {
  it('كل رمز خطأ له رسالة عربية وإنجليزية', () => {
    for (const code of Object.values(ErrorCode)) {
      expect(ErrorMessagesAr[code], `missing ar message for ${code}`).toBeTruthy();
      expect(ErrorMessagesEn[code], `missing en message for ${code}`).toBeTruthy();
    }
  });

  it('getUserMessage يعيد الرسالة حسب اللغة', () => {
    expect(getUserMessage(ErrorCode.FILE_TOO_LARGE, 'ar')).toContain('الحد');
    expect(getUserMessage(ErrorCode.FILE_TOO_LARGE, 'en')).toContain('maximum');
  });

  it('getUserMessage يعيد رسالة عامة لرمز غير معروف', () => {
    expect(getUserMessage('SOMETHING_UNKNOWN', 'ar')).toBe(ErrorMessagesAr[ErrorCode.INTERNAL_ERROR]);
  });
});

describe('حدود مشتركة', () => {
  it('حد رسالة تلجرام ثابت 4096', () => {
    expect(TELEGRAM_MAX_MESSAGE_LENGTH).toBe(4096);
  });

  it('الامتدادات المسموحة تشمل .md', () => {
    expect(ALLOWED_MARKDOWN_EXTENSIONS).toContain('.md');
  });
});

describe('مخططات التحقق (Zod)', () => {
  it('channelConnectSchema يقبل @username ومعرفًا رقميًا', () => {
    expect(channelConnectSchema.safeParse({ chatRef: '@my_channel' }).success).toBe(true);
    expect(channelConnectSchema.safeParse({ chatRef: '-1001234567890' }).success).toBe(true);
  });

  it('channelConnectSchema يرفض نصًا غير صالح', () => {
    expect(channelConnectSchema.safeParse({ chatRef: 'bad channel!' }).success).toBe(false);
    expect(channelConnectSchema.safeParse({ chatRef: '@a' }).success).toBe(false);
  });

  it('draftCreateSchema يرفض محتوى فارغًا', () => {
    expect(draftCreateSchema.safeParse({ contentMarkdown: '' }).success).toBe(false);
  });

  it('draftCreateSchema يرفض محتوى يتجاوز الحد', () => {
    const tooLong = 'a'.repeat(100_001);
    expect(draftCreateSchema.safeParse({ contentMarkdown: tooLong }).success).toBe(false);
  });

  it('publishSchema يضع allowDuplicate=false افتراضيًا', () => {
    const parsed = publishSchema.parse({
      channelId: '11111111-1111-4111-8111-111111111111',
      contentMarkdown: 'نص'
    });
    expect(parsed.allowDuplicate).toBe(false);
  });

  it('publishSchema يرفض channelId غير UUID', () => {
    expect(
      publishSchema.safeParse({ channelId: 'not-a-uuid', contentMarkdown: 'نص' }).success
    ).toBe(false);
  });

  it('previewSchema يرفض نصًا فارغًا', () => {
    expect(previewSchema.safeParse({ contentMarkdown: '' }).success).toBe(false);
  });
});
