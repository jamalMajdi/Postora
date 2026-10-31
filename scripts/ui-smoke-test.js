#!/usr/bin/env node
/**
 * اختبار واجهة فعلي في متصفح حقيقي (Chromium) عبر Puppeteer.
 *
 * يحاكي بيئة تلجرام Mini App:
 *  - يحقن window.Telegram.WebApp.initData موقّعًا بمفتاح تطوير (بدون أسرار حقيقية)
 *  - يفتح التطبيق ويفحص:
 *      1) تحميل لوحة التحكم
 *      2) الانتقال إلى المحرر
 *      3) كتابة Markdown ورؤية المعاينة المطابقة
 *      4) ربط قناة
 *      5) النشر ورؤية النتيجة
 *      6) حفظ مسودة وظهورها في القائمة
 *  - يحفظ لقطات شاشة في tests-artifacts/
 *
 * الاستخدام: node scripts/ui-smoke-test.js
 * متطلبات: Chromium مثبت + الخادم يعمل على 3000 + Vite على 5173
 */
import puppeteer from 'puppeteer-core';
import { createHmac } from 'node:crypto';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ARTIFACTS = path.join(__dirname, '..', 'tests-artifacts');

const APP_URL = process.env.UI_APP_URL || 'http://127.0.0.1:5173/';
const BOT_TOKEN = process.env.BOT_TOKEN || '123456:DEV_PLACEHOLDER_TOKEN_NOT_REAL';
const CHROME = process.env.CHROME_PATH || '/usr/bin/chromium';

const results = [];
let browser;

function log(step, ok, detail = '') {
  results.push({ step, ok, detail });
  console.log(`${ok ? '✅' : '❌'} ${step}${detail ? ` — ${detail}` : ''}`);
}

/** يبني initData موقّعًا صحيحًا (نفس آلية تلجرام) لتجربة الواجهة محليًا. */
function buildInitData(user, token) {
  const authDate = Math.floor(Date.now() / 1000);
  const params = new URLSearchParams();
  params.set('auth_date', String(authDate));
  params.set('query_id', `dev-${authDate}`);
  params.set('user', JSON.stringify(user));

  const pairs = [...params.entries()].sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0));
  const dataCheckString = pairs.map(([k, v]) => `${k}=${v}`).join('\n');
  const secret = createHmac('sha256', 'WebAppData').update(token).digest();
  const hash = createHmac('sha256', secret).update(dataCheckString).digest('hex');
  params.set('hash', hash);
  return params.toString();
}

async function main() {
  await mkdir(ARTIFACTS, { recursive: true });

  const initData = buildInitData(
    {
      id: 111222333,
      first_name: 'سالم',
      last_name: 'التجريبي',
      username: 'salem_dev',
      language_code: 'ar'
    },
    BOT_TOKEN
  );

  browser = await puppeteer.launch({
    executablePath: CHROME,
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage']
  });

  const page = await browser.newPage();
  await page.setViewport({ width: 390, height: 844, deviceScaleFactor: 2, isMobile: true });

  // نمنع تحميل سكربت تلجرام الخارجي حتى يبقى الحقن المحلي فعّالًا
  // (في الإنتاج يحمّل السكربت الحقيقي من telegram.org ويوفر initData بنفسه)
  await page.setRequestInterception(true);
  page.on('request', (request) => {
    if (request.url().includes('telegram.org/js/telegram-web-app.js')) {
      request.abort();
      return;
    }
    request.continue();
  });

  const consoleErrors = [];
  page.on('console', (message) => {
    if (message.type() === 'error') consoleErrors.push(message.text());
  });
  page.on('pageerror', (error) => consoleErrors.push(String(error)));

  // حقن Telegram.WebApp قبل تحميل أي سكربت (كما يفعل تلجرام فعلًا)
  await page.evaluateOnNewDocument((data) => {
    window.Telegram = {
      WebApp: {
        initData: data,
        initDataUnsafe: {
          user: { id: 111222333, first_name: 'سالم', username: 'salem_dev', language_code: 'ar' }
        },
        colorScheme: 'light',
        themeParams: {},
        ready() {},
        expand() {},
        enableClosingConfirmation() {},
        setHeaderColor() {},
        HapticFeedback: {
          impactOccurred() {},
          notificationOccurred() {}
        },
        showConfirm(message, callback) {
          callback(true);
        },
        showAlert() {}
      }
    };
  }, initData);

  // إعادة تعيين اللغة إلى العربية حتى تكون التوقعات حتمية بغض النظر عن تشغيلات سابقة
  await fetch('http://127.0.0.1:3000/api/auth/session', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ initData })
  })
    .then((response) => response.json())
    .then((body) => {
      const token = body?.data?.token;
      if (!token) return null;
      return fetch('http://127.0.0.1:3000/api/me/locale', {
        method: 'PATCH',
        headers: { 'content-type': 'application/json', authorization: `Bearer ${token}` },
        body: JSON.stringify({ locale: 'ar' })
      });
    })
    .catch(() => null);

  /* ---------------- 1) تحميل لوحة التحكم ---------------- */
  await page.goto(APP_URL, { waitUntil: 'networkidle2', timeout: 30000 });
  await page.waitForFunction(
    () => document.body.innerText.includes('Postora') && !document.body.innerText.includes('جارٍ التحميل'),
    { timeout: 20000 }
  );

  const dashboardText = await page.evaluate(() => document.body.innerText);
  log(
    'تحميل لوحة التحكم',
    /Dashboard|لوحة التحكم/.test(dashboardText) || /مرحبًا|Welcome/.test(dashboardText),
    'dashboard rendered'
  );
  await page.screenshot({ path: path.join(ARTIFACTS, '01-dashboard.png') });

  /* ---------------- 2) الانتقال إلى المحرر ---------------- */
  await page.evaluate(() => document.querySelectorAll('.app-nav__item')[1]?.click());
  await page.waitForSelector('.editor-textarea', { timeout: 10000 });
  log('فتح المحرر', true, 'editor textarea visible');
  await page.screenshot({ path: path.join(ARTIFACTS, '02-editor-empty.png') });

  /* ---------------- 3) كتابة Markdown ومعاينة ---------------- */
  const runId = new Date().toISOString().replace(/[:.]/g, '-');
  const article = `# مقال اختباري من الواجهة (${runId})

هذا نص **عريض** و *مائل* و ~~مشطوب~~ و \`كود\`.

- عنصر أول
- عنصر ثانٍ

> اقتباس تجريبي

[رابط تجريبي](https://example.com)

| عمود | قيمة |
|---|---|
| أ | 1 |`;

  await page.click('.editor-textarea');
  await page.type('.editor-textarea', article, { delay: 0 });

  // التحقق من إحصاءات المعاينة (المحرك يعمل في المتصفح)
  await page.waitForFunction(
    () => {
      const bar = document.querySelector('.stats-bar');
      return bar && /[1-9]/.test(bar.innerText);
    },
    { timeout: 10000 }
  );
  const statsText = await page.evaluate(() => document.querySelector('.stats-bar').innerText);
  log('المعاينة المباشرة تعمل', /\d/.test(statsText), statsText.replace(/\n/g, ' '));

  // التبديل إلى تبويب معاينة تلجرام
  await page.evaluate(() => {
    const tabs = [...document.querySelectorAll('.editor-tabs__tab')];
    tabs.find((tab) => tab.innerText.includes('معاينة'))?.click();
  });
  await page.waitForSelector('.tg-preview', { timeout: 10000 });

  const previewHtml = await page.evaluate(() => document.querySelector('.tg-preview').innerHTML);
  const hasBold = /<b>/.test(previewHtml);
  const hasItalic = /<i>/.test(previewHtml);
  const hasStrike = /<s>/.test(previewHtml);
  const hasCode = /<code>/.test(previewHtml);
  const hasLink = /<a /.test(previewHtml);
  const hasBlockquote = /<blockquote>/.test(previewHtml);
  const hasPre = /<pre>/.test(previewHtml);

  log(
    'معاينة تلجرام تطابق التنسيقات',
    hasBold && hasItalic && hasStrike && hasCode && hasLink && hasBlockquote && hasPre,
    `bold=${hasBold} italic=${hasItalic} strike=${hasStrike} code=${hasCode} link=${hasLink} quote=${hasBlockquote} pre=${hasPre}`
  );
  await page.screenshot({ path: path.join(ARTIFACTS, '03-preview.png') });

  /* ---------------- 4) ربط قناة ---------------- */
  await page.evaluate(() => document.querySelectorAll('.app-nav__item')[3]?.click());
  await new Promise((resolve) => setTimeout(resolve, 500));

  await page.evaluate(() => {
    const button = [...document.querySelectorAll('button')].find((b) =>
      /إضافة قناة|Add channel/.test(b.innerText)
    );
    button?.click();
  });
  await page.waitForSelector('#chat-ref', { timeout: 10000 });
  await page.type('#chat-ref', '@postora_demo_channel', { delay: 0 });
  await page.screenshot({ path: path.join(ARTIFACTS, '04-add-channel.png') });

  await page.evaluate(() => {
    const form = document.querySelector('.sheet form');
    const submit = form?.querySelector('button[type="submit"]');
    submit?.click();
  });

  await page.waitForFunction(
    () => document.body.innerText.includes('postora_demo_channel'),
    { timeout: 20000 }
  );
  log('ربط القناة عبر الواجهة', true, '@postora_demo_channel connected');
  await page.screenshot({ path: path.join(ARTIFACTS, '05-channels.png') });

  /* ---------------- 5) النشر ---------------- */
  await page.evaluate(() => document.querySelectorAll('.app-nav__item')[1]?.click());
  await page.waitForSelector('.editor-textarea', { timeout: 10000 });

  // إعادة كتابة المحتوى (الصفحة أُعيد تركيبها)
  await page.click('.editor-textarea');
  await page.evaluate(() => {
    const textarea = document.querySelector('.editor-textarea');
    textarea.value = '';
  });
  await page.type('.editor-textarea', article, { delay: 0 });
  await new Promise((resolve) => setTimeout(resolve, 400));

  await page.evaluate(() => {
    const publishButton = [...document.querySelectorAll('button')].find((b) =>
      /نشر الآن|Publish now/.test(b.innerText)
    );
    publishButton?.click();
  });

  await page.waitForFunction(
    () => /تم النشر بنجاح|Published successfully/.test(document.body.innerText),
    { timeout: 30000 }
  );
  log('النشر من الواجهة', true, 'publication succeeded');
  await page.screenshot({ path: path.join(ARTIFACTS, '06-published.png') });

  /* ---------------- 6) حفظ مسودة ---------------- */
  await page.evaluate(() => {
    const saveButton = [...document.querySelectorAll('button')].find((b) =>
      /حفظ كمسودة|Save as draft/.test(b.innerText)
    );
    saveButton?.click();
  });
  await new Promise((resolve) => setTimeout(resolve, 1500));

  await page.evaluate(() => document.querySelectorAll('.app-nav__item')[2]?.click());
  await page.waitForFunction(
    () => document.body.innerText.includes('مقال اختباري') || document.body.innerText.includes('مسودة'),
    { timeout: 15000 }
  );
  const draftsText = await page.evaluate(() => document.body.innerText);
  log('حفظ وعرض المسودات', draftsText.includes('مقال اختباري') || /\d+\s*حرف/.test(draftsText), 'draft listed');
  await page.screenshot({ path: path.join(ARTIFACTS, '07-drafts.png') });

  /* ---------------- 7) اللغة الإنجليزية و LTR ---------------- */
  await page.evaluate(() => {
    const toggle = [...document.querySelectorAll('button')].find((b) => b.innerText.trim() === 'EN');
    toggle?.click();
  });
  await new Promise((resolve) => setTimeout(resolve, 800));
  const dirAfter = await page.evaluate(() => document.documentElement.dir);
  const enText = await page.evaluate(() => document.body.innerText);
  log('تبديل اللغة إلى الإنجليزية + LTR', dirAfter === 'ltr', `dir=${dirAfter}, english=${/Dashboard|Drafts|Channels/.test(enText)}`);
  await page.screenshot({ path: path.join(ARTIFACTS, '08-english.png') });

  // العودة إلى العربية ليبقى التطبيق في حالته الافتراضية بعد الاختبار
  await page.evaluate(() => {
    const toggle = [...document.querySelectorAll('button')].find((b) => b.innerText.trim() === 'ع');
    toggle?.click();
  });
  await new Promise((resolve) => setTimeout(resolve, 600));

  /* ---------------- 8) أخطاء الكونسول ---------------- */
  // نستثني أخطاء متوقعة في بيئة الاختبار: favicon غائب، وحجب سكربت تلجرام الخارجي
  const criticalErrors = consoleErrors.filter(
    (error) =>
      !/favicon|ResizeObserver|Download the React DevTools|net::ERR_FAILED|status of 404|status of 409/i.test(
        error
      )
  );
  log('لا أخطاء JavaScript في الكونسول', criticalErrors.length === 0, criticalErrors.slice(0, 3).join(' | '));

  /* ---------------- التقرير ---------------- */
  const summary = {
    generatedAt: new Date().toISOString(),
    appUrl: APP_URL,
    total: results.length,
    passed: results.filter((r) => r.ok).length,
    failed: results.filter((r) => !r.ok).length,
    consoleErrors: criticalErrors,
    results
  };

  await writeFile(
    path.join(ARTIFACTS, 'ui-smoke-report.json'),
    JSON.stringify(summary, null, 2),
    'utf8'
  );

  console.log(`\n${summary.passed}/${summary.total} خطوة ناجحة`);
  if (summary.failed > 0) process.exitCode = 1;
}

main()
  .catch(async (error) => {
    console.error('❌ فشل اختبار الواجهة:', error?.message);
    try {
      if (browser) {
        const pages = await browser.pages();
        await pages[0]?.screenshot({ path: path.join(ARTIFACTS, 'failure.png') });
      }
    } catch {
      // تجاهل
    }
    process.exitCode = 1;
  })
  .finally(async () => {
    await browser?.close();
  });
