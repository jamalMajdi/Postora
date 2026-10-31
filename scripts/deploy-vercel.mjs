#!/usr/bin/env node
/**
 * تجهيز نشر Mini App على Vercel.
 *
 * يفعل شيئين:
 *   1) يستبدل نطاق الـ Backend داخل apps/miniapp/vercel.json (rewrites).
 *   2) يطبع القيم المطلوبة في الخادم (CORS_ORIGINS, MINIAPP_URL) وخطوات BotFather.
 *
 * الاستخدام:
 *   node scripts/deploy-vercel.mjs https://api.your-domain.com https://your-app.vercel.app
 *
 * الوسيط الثاني (نطاق الواجهة) اختياري — تحتاجه بعد أول نشر.
 * السكربت لا يُرسل أي شيء إلى الشبكة ولا يحتاج أي توكن.
 */
import { readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const VERCEL_JSON = path.join(ROOT, 'apps', 'miniapp', 'vercel.json');

const PLACEHOLDER = 'https://REPLACE-WITH-YOUR-BACKEND-DOMAIN';

const backendUrl = (process.argv[2] || '').replace(/\/$/, '');
const miniappUrl = (process.argv[3] || '').replace(/\/$/, '');

function fail(message) {
  console.error(`\n❌ ${message}\n`);
  process.exit(1);
}

if (!backendUrl) {
  console.log(`
الاستخدام:
  node scripts/deploy-vercel.mjs <BACKEND_URL> [MINIAPP_URL]

مثال:
  node scripts/deploy-vercel.mjs https://postora-api.onrender.com
  node scripts/deploy-vercel.mjs https://postora-api.onrender.com https://postora.vercel.app

  BACKEND_URL : النطاق العام للخادم (Express + Telegraf) — يجب أن يكون HTTPS
  MINIAPP_URL : نطاق الواجهة على Vercel (يُطبع بعد أول نشر)
`);
  process.exit(1);
}

if (!/^https:\/\//.test(backendUrl)) {
  fail('BACKEND_URL يجب أن يبدأ بـ https:// — تلجرام يرفض HTTP.');
}

let raw;
try {
  raw = readFileSync(VERCEL_JSON, 'utf8');
} catch {
  fail(`لم أجد ${path.relative(ROOT, VERCEL_JSON)}`);
}

// استبدال كل النطاقات الوهمية بالنطاق الحقيقي
const previous = raw.includes(PLACEHOLDER) ? PLACEHOLDER : null;
const updated = raw.split(PLACEHOLDER).join(backendUrl);

if (!previous) {
  console.log('ℹ️  لم أجد القيمة الافتراضية — سأستبدل أي نطاق سابق في rewrites.');
}

const parsed = JSON.parse(updated);
// ضمان أن rewrites تشير فعليًا إلى النطاق المطلوب
for (const rule of parsed.rewrites ?? []) {
  if (rule.destination.includes('REPLACE-WITH')) {
    fail('بقي نطاق وهمي في vercel.json — عدّل الملف يدويًا.');
  }
}

writeFileSync(VERCEL_JSON, `${JSON.stringify(parsed, null, 2)}\n`, 'utf8');

console.log(`
✅ تم تحديث apps/miniapp/vercel.json
   /api/*  →  ${backendUrl}/api/*
   /health →  ${backendUrl}/health
`);

console.log(`──────────── الخطوات التالية ────────────

1) انشر الواجهة:
     cd apps/miniapp
     npx vercel --prod

   (أول مرة يسألك عن ربط المشروع — وافق على الإعدادات الافتراضية.
    vercel.json يتكفّل بأمر التثبيت والبناء من جذر الـ monorepo.)

2) بعد النشر ستحصل على نطاق مثل: https://postora-abc.vercel.app
   ${
     miniappUrl
       ? `   نطاقك: ${miniappUrl}`
       : '   أعد تشغيل هذا السكربت مع النطاق لطباعة إعدادات الخادم:'
   }${
     miniappUrl
       ? `
3) على الخادم (Backend) أضف في .env:
     CORS_ORIGINS=${miniappUrl}
     MINIAPP_URL=${miniappUrl}
   ثم أعد تشغيل الخادم.`
       : `
   node scripts/deploy-vercel.mjs ${backendUrl} https://your-app.vercel.app`
   }

${miniappUrl ? '4' : '3'}) في BotFather (@BotFather):
     /mybots → @Postora_1bot → Bot Settings → Menu Button
     → أرسل: ${miniappUrl || 'https://your-app.vercel.app'}

${miniappUrl ? '5' : '4'}) تحقق داخل تلجرام:
     افتح @Postora_1bot ← اضغط زر القائمة ← يجب أن يفتح التطبيق مع initData تلقائيًا.

⚠️  مهم: /api يُمرَّر عبر Vercel إلى خادمك، لذا لا حاجة لـ CORS في هذه الحالة.
    لكن اترك CORS_ORIGINS مضبوطًا احتياطًا.
`);
