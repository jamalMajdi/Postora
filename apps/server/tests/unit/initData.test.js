import { createHmac } from 'node:crypto';
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

  /* ------------------------------------------------------------------
   * انحدار: حقل `signature` الذي يضيفه تلجرام في العملاء الحديثة.
   *
   * تلجرام يوقّع HMAC على **كل** الحقول الواردة عدا `hash`.
   * استثناء `signature` يخصّ مسار Ed25519 وحده، وليس تحقق توكن البوت.
   * استثناؤه هنا كان يرفض كل تشغيل حقيقي للتطبيق داخل تلجرام.
   * ------------------------------------------------------------------ */

  it('يقبل initData حقيقية تحتوي حقل signature (تحقق HMAC بتوكن البوت)', () => {
    const authDate = Math.floor(Date.now() / 1000);
    const params = new URLSearchParams();
    params.set('auth_date', String(authDate));
    params.set('query_id', `AAH${authDate}`);
    params.set('user', JSON.stringify(USER));
    params.set('signature', 'ZmFrZV9lZDI1NTE5X3NpZ25hdHVyZV92YWx1ZV9mb3JfdGVzdA==');

    // نبني التوقيع كما يبنيه تلجرام: كل الحقول عدا hash (بما فيها signature)
    const pairs = [...params.entries()].sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0));
    const dataCheckString = pairs.map(([k, v]) => `${k}=${v}`).join('\n');
    const secretKey = createHmac('sha256', 'WebAppData').update(TOKEN).digest();
    params.set('hash', createHmac('sha256', secretKey).update(dataCheckString).digest('hex'));

    const initData = params.toString();
    expect(initData).toContain('signature=');

    const result = validateInitData(initData, { botToken: TOKEN });
    expect(String(result.user.id)).toBe(String(USER.id));
    expect(result.user.username).toBe(USER.username);
  });

  it('يرفض initData تحمل signature معدّلًا بعد التوقيع', () => {
    const authDate = Math.floor(Date.now() / 1000);
    const params = new URLSearchParams();
    params.set('auth_date', String(authDate));
    params.set('query_id', `AAH${authDate}`);
    params.set('user', JSON.stringify(USER));
    params.set('signature', 'ORIGINAL_SIGNATURE');

    const pairs = [...params.entries()].sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0));
    const dataCheckString = pairs.map(([k, v]) => `${k}=${v}`).join('\n');
    const secretKey = createHmac('sha256', 'WebAppData').update(TOKEN).digest();
    params.set('hash', createHmac('sha256', secretKey).update(dataCheckString).digest('hex'));

    // تعديل signature بعد التوقيع ⇒ يجب الرفض (يثبت أن signature داخل نطاق التوقيع)
    const tampered = params.toString().replace('ORIGINAL_SIGNATURE', 'TAMPERED_SIGNATURE');
    expect(() => validateInitData(tampered, { botToken: TOKEN })).toThrowError(
      /AUTH_INVALID_INIT_DATA/
    );
  });

  it('حذف signature من initData موقّعة معه يُبطل التوقيع (إثبات أنه ليس حقلًا حرًّا)', () => {
    const authDate = Math.floor(Date.now() / 1000);
    const params = new URLSearchParams();
    params.set('auth_date', String(authDate));
    params.set('query_id', `AAH${authDate}`);
    params.set('user', JSON.stringify(USER));
    params.set('signature', 'SOME_SIGNATURE');

    const pairs = [...params.entries()].sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0));
    const dataCheckString = pairs.map(([k, v]) => `${k}=${v}`).join('\n');
    const secretKey = createHmac('sha256', 'WebAppData').update(TOKEN).digest();
    params.set('hash', createHmac('sha256', secretKey).update(dataCheckString).digest('hex'));

    const stripped = params
      .toString()
      .split('&')
      .filter((pair) => !pair.startsWith('signature='))
      .join('&');

    expect(() => validateInitData(stripped, { botToken: TOKEN })).toThrowError(
      /AUTH_INVALID_INIT_DATA/
    );
  });
});
