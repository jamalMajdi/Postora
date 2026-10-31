import { describe, it, expect } from 'vitest';
import { validateInitData, buildInitDataForTests } from '../../src/telegram/initDataValidator.js';

const TOKEN = '123456:TEST_TOKEN_NOT_REAL_FOR_TESTS_ONLY';
const USER = { id: 987654321, first_name: 'سالم', username: 'salem', language_code: 'ar' };

/**
 * اختبارات وحدة للتحقق من initData — أهم بوابة أمنية في المشروع.
 * تعتمد على آلية تلجرام الرسمية (HMAC-SHA256 + WebAppData).
 */
describe('initData validator', () => {
  it('يقبل initData صحيحًا ويعيد هوية المستخدم', () => {
    const initData = buildInitDataForTests(USER, TOKEN);
    const result = validateInitData(initData, { botToken: TOKEN });

    expect(result.user.id).toBe(String(USER.id));
    expect(result.user.username).toBe('salem');
    expect(result.user.first_name).toBe('سالم');
    expect(result.authDate).toBeGreaterThan(0);
  });

  it('يرفض initData فارغًا أو غائبًا', () => {
    expect(() => validateInitData('', { botToken: TOKEN })).toThrowError(/AUTH_MISSING/);
    expect(() => validateInitData(null, { botToken: TOKEN })).toThrowError(/AUTH_MISSING/);
  });

  it('يرفض initData بلا hash', () => {
    const initData = buildInitDataForTests(USER, TOKEN);
    const withoutHash = initData
      .split('&')
      .filter((pair) => !pair.startsWith('hash='))
      .join('&');

    expect(() => validateInitData(withoutHash, { botToken: TOKEN })).toThrowError(
      /AUTH_INVALID_INIT_DATA/
    );
  });

  it('يرفض تعديل أي حقل بعد التوقيع', () => {
    const initData = buildInitDataForTests(USER, TOKEN);
    const tampered = initData.replace(
      encodeURIComponent(JSON.stringify(USER)),
      encodeURIComponent(JSON.stringify({ ...USER, id: 1 }))
    );

    expect(tampered).not.toBe(initData);
    expect(() => validateInitData(tampered, { botToken: TOKEN })).toThrowError(
      /AUTH_INVALID_INIT_DATA/
    );
  });

  it('يرفض initData موقّعة بتوكن آخر', () => {
    const initData = buildInitDataForTests(USER, '999999:OTHER_BOT_TOKEN');
    expect(() => validateInitData(initData, { botToken: TOKEN })).toThrowError(
      /AUTH_INVALID_INIT_DATA/
    );
  });

  it('يرفض initData قديمة (أكبر من الحد المسموح)', () => {
    const oldDate = Math.floor(Date.now() / 1000) - 7200;
    const initData = buildInitDataForTests(USER, TOKEN, { authDate: oldDate });

    expect(() =>
      validateInitData(initData, { botToken: TOKEN, maxAgeSeconds: 3600 })
    ).toThrowError(/AUTH_EXPIRED_INIT_DATA/);
  });

  it('يقبل initData قديمة إن كان الحد المسموح أوسع', () => {
    const date = Math.floor(Date.now() / 1000) - 7200;
    const initData = buildInitDataForTests(USER, TOKEN, { authDate: date });

    const result = validateInitData(initData, { botToken: TOKEN, maxAgeSeconds: 86400 });
    expect(result.user.id).toBe(String(USER.id));
  });

  it('يرفض initData بلا حقل user', () => {
    const initData = buildInitDataForTests(USER, TOKEN);
    const withoutUser = initData
      .split('&')
      .filter((pair) => !pair.startsWith('user='))
      .join('&');

    expect(() => validateInitData(withoutUser, { botToken: TOKEN })).toThrowError(
      /AUTH_INVALID_INIT_DATA/
    );
  });

  it('لا يفرض شكلًا محددًا على orderOfFields (يعتمد الترتيب الأبجدي داخليًا)', () => {
    const a = buildInitDataForTests(USER, TOKEN, { authDate: 1700000000 });
    const b = buildInitDataForTests(USER, TOKEN, { authDate: 1700000000 });
    expect(a).toBe(b); // حتمية
  });
});
