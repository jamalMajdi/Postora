# نشر Mini App على Vercel

> **الهدف:** الحصول على رابط HTTPS عام لتطبيق Postora المصغّر، ثم ربطه بـ `@Postora_1bot`
> حتى يفتح داخل تلجرام مع `initData` حقيقية.
>
> **الوقت المتوقع:** 15–20 دقيقة · **التكلفة:** مجاني (خطة Hobby).

---

## 0) ما تحتاجه قبل البدء

| # | المتطلب | لماذا |
|---|---|---|
| 1 | حساب [Vercel](https://vercel.com) (مجاني) | استضافة الواجهة |
| 2 | مستودع Git (GitHub/GitLab/Bitbucket) | Vercel ينشر من المستودع |
| 3 | **نطاق عام HTTPS للخادم (Backend)** | الـ API يجب أن يكون متاحًا للإنترنت |
| 4 | `@BotFather` على تلجرام | لضبط Menu Button |

> ⚠️ **الخادم ليس على Vercel.** Vercel يشغّل الواجهة الثابتة فقط (ملفات HTML/JS/CSS).
> الخادم (Express + Telegraf + PostgreSQL) يحتاج استضافة تشغيل مستمر مثل
> **Render / Railway / Fly.io / VPS**. راجع `docs/DEPLOYMENT.md`.

**مخطط الشبكة بعد النشر:**

```
   تلجرام WebView
        │ HTTPS
   ┌────▼──────────────────┐
   │  your-app.vercel.app  │  ← الواجهة (ملفات ثابتة)
   │         │             │
   │   /api/*: rewrite     │  ← vercel.json يمرّرها
   └─────────┼─────────────┘
             │ HTTPS
   ┌─────────▼─────────────┐
   │  api.your-domain.com  │  ← الخادم + البوت + PostgreSQL
   └───────────────────────┘
```

---

## 1) نشر الخادم أولًا (Backend)

Vercel لا يستضيفه. اختر واحدة:

| الخيار | مجاني؟ | ملاحظات |
|---|---|---|
| **Render** | نعم (Web Service) | ينام بعد خمول — استخدم `BOT_MODE=webhook` |
| **Railway** | تجربة ثم مدفوع | أسهل ربط بـ PostgreSQL |
| **Fly.io** | محدود | يحتاج `flyctl` |
| **VPS + Docker** | مدفوع | الأكثر تحكمًا — `docs/DEPLOYMENT.md` |

**المطلوب في النهاية:** نطاق HTTPS واحد يعمل عليه `GET /health`.

تحقق:

```bash
curl https://api.your-domain.com/health
# {"ok":true,"service":"postora","version":"1.0.0","db":"up",...}
```

> الخادم على منصات تنام (Render free) ⇒ استخدم `BOT_MODE=webhook` لا polling.

---

## 2) تحديث `vercel.json` بنطاق خادمك

في المستودع:

```
apps/miniapp/vercel.json
```

فيه قيمتان وهميتان:

```json
"rewrites": [
  { "source": "/api/:path*", "destination": "https://REPLACE-WITH-YOUR-BACKEND-DOMAIN/api/:path*" },
  { "source": "/health",    "destination": "https://REPLACE-WITH-YOUR-BACKEND-DOMAIN/health" }
]
```

استبدلهما بنطاقك. **أسهل طريقة — سكربت جاهز:**

```bash
node scripts/deploy-vercel.mjs https://api.your-domain.com
```

سيعدّل الملف ويطبع الخطوات التالية. (بعد أول نشر، شغّله مرة أخرى مع نطاق Vercel لطباعة إعدادات الخادم.)

---

## 3) انشر الواجهة

### الطريقة أ: من سطر الأوامر (الأسرع)

```bash
cd apps/miniapp
npx vercel --prod
```

أول مرة سيسألك:
- **Set up and deploy?** ← `Y`
- **Which scope?** ← حسابك
- **Link to existing project?** ← `N`
- **Project name?** ← `postora` (أو ما تريد)
- **In which directory is your code located?** ← `./` (اضغط Enter)

> `vercel.json` في نفس المجلد ويتكفّل بأوامر التثبيت والبناء من **جذر الـ monorepo**
> (`cd ../.. && npm install` ثم `npm run build --workspace @postora/miniapp`).

**بعد النشر ستحصل على رابط مثل:** `https://postora-abc123.vercel.app`

### الطريقة ب: من لوحة Vercel (Git)

1. <https://vercel.com/new> ← **Import Git Repository** ← اختر `postora`
2. **Root Directory** ← `apps/miniapp` ← **Edit**
3. **Framework Preset** ← `Vite` (يُكتشف تلقائيًا)
4. **Install Command** ← `cd ../.. && npm install --no-audit --no-fund`
5. **Build Command** ← `cd ../.. && npm run build --workspace @postora/miniapp`
6. **Output Directory** ← `apps/miniapp/dist`
7. **Deploy**

> ⚠️ إن تركت **Root Directory** فارغًا سيفشل البناء لأن المشروع monorepo.

---

## 4) اضبط الخادم

على الخادم (Backend) أضف إلى `.env`:

```env
CORS_ORIGINS=https://postora-abc123.vercel.app
MINIAPP_URL=https://postora-abc123.vercel.app
```

ثم أعد تشغيل الخادم.

> **لماذا `CORS_ORIGINS`؟** في الوضع الافتراضي Vercel يمرّر `/api` من نفس النطاق فلا حاجة لـ CORS.
> لكن إن استخدمت `VITE_API_BASE_URL` لاستدعاء الخادم مباشرة، فسيمنع المتصفح الطلب بدون CORS.
> ضبطه احتياطًا آمن ومفيد.

---

## 5) اربط Mini App بالبوت في BotFather

1. افتح [@BotFather](https://t.me/BotFather)
2. `/mybots` ← `@Postora_1bot`
3. **Bot Settings** ← **Menu Button**
4. أرسل الرابط: `https://postora-abc123.vercel.app`
5. (اختياري) **Configure Mini App** ← نفس الرابط ⇒ يفعّل `t.me/Postora_1bot/app`

---

## 6) اختبر داخل تلجرام

1. افتح [@Postora_1bot](https://t.me/Postora_1bot)
2. اضغط زر القائمة (أسفل يسار)
3. يجب أن يفتح Postora **داخل تلجرام** مع تحقق `initData` تلقائيًا

**علامات النجاح:**

| ما تراه | المعنى |
|---|---|
| لوحة التحكم ببياناتك | ✅ كل شيء يعمل |
| شاشة "افتح من تلجرام" | ⚠️ `initData` فارغة — افتحه من الزر لا من متصفح |
| خطأ 401 | ⚠️ `initData` لا يُتحقق — تأكد أن `BOT_TOKEN` في الخادم هو نفسه توكن البوت |
| صفحة بيضاء | ⚠️ فشل تحميل الأصول — تحقق من Output Directory في Vercel |
| `INTERNAL_ERROR` عند أي طلب | ⚠️ الـ rewrite لا يصل — تحقق من النطاق في `vercel.json` |

---

## 7) عند استخدام `VITE_API_BASE_URL` بدلًا من الـ rewrite

إن فضّلت استدعاء الخادم مباشرة (بدون تمرير عبر Vercel):

1. في لوحة Vercel: **Settings** ← **Environment Variables** ← أضف:
   ```
   VITE_API_BASE_URL = https://api.your-domain.com
   ```
2. أعد النشر: **Deployments** ← **Redeploy**
3. في الخادم: `CORS_ORIGINS=https://postora-abc123.vercel.app` **إلزامي**.

**أيهما أفضل؟** الـ rewrite الافتراضي أنسب لأنه:
- لا يحتاج CORS
- يخفي نطاق الخادم
- لا يعرّض الـ API لطلبات من نطاقات أخرى

---

## 8) نطاق مخصص (اختياري)

**لوحة Vercel** ← مشروعك ← **Settings** ← **Domains** ← **Add**

- إن كان النطاق على Cloudflare: أضف CNAME إلى `cname.vercel-dns.com` (DNS only، ليس Proxied)
- Vercel يصدر شهادة TLS تلقائيًا

ثم حدّث:
- `MINIAPP_URL` و`CORS_ORIGINS` في الخادم
- Menu Button في BotFather

---

## 9) استكشاف أخطاء Vercel

| الخطأ | السبب | الحل |
|---|---|---|
| `No Output Directory named "dist"` | Root Directory خاطئ | اجعله `apps/miniapp` |
| `Cannot find module '@postora/markdown-engine'` | البناء من داخل `apps/miniapp` وحده | استخدم أمر البناء من الجذر (موجود في `vercel.json`) |
| `npm ERR! workspace not found` | الـ install لم يُنفَّذ من الجذر | تحقق من `installCommand` |
| البناء ينجح والصفحة بيضاء | مسارات الأصول | تأكد أن `base` افتراضي (`/`) في `vite.config.js` |
| `404` على `/api/...` | rewrite غير مطبَّق | تحقق من `vercel.json` وأن النشر أعاد البناء بعد تعديله |
| `401` داخل تلجرام فقط | `BOT_TOKEN` مختلف بين الواجهة والخادم | الواجهة لا تحمل توكنًا أصلًا — المشكلة في تحقق الخادم |

**فحص سريع من المتصفح بعد النشر:**

```bash
curl -I https://postora-abc123.vercel.app/                      # 200
curl https://postora-abc123.vercel.app/health                   # {"ok":true,...}
curl -X POST https://postora-abc123.vercel.app/api/auth/session # 400 (يتوقع initData)
```

> آخر أمر **يجب أن يعيد 400 `VALIDATION_ERROR`** — هذا يثبت أن الـ rewrite يصل إلى الخادم.

---

## 10) قائمة تحقق نهائية

- [ ] الخادم يعمل على HTTPS و`/health` يرجع `ok:true`
- [ ] `vercel.json` يحتوي نطاق خادمك (لا `REPLACE-WITH-...`)
- [ ] Vercel: Root Directory = `apps/miniapp`
- [ ] النشر ناجح ويوجد `dist` بالإخراج
- [ ] `curl .../api/auth/session` يرجع 400 لا 404
- [ ] `CORS_ORIGINS` و`MINIAPP_URL` مضبوطان في الخادم
- [ ] Menu Button في BotFather يشير إلى نطاق Vercel
- [ ] التطبيق يفتح داخل تلجرام ويعرض لوحة التحكم ببياناتك
- [ ] ربط قناة + نشر تجريبي يعملان من داخل تلجرام

---

## 11) بعد النشر — تنظيف

- ❌ لا تضع `BOT_TOKEN` في متغيرات Vercel — الواجهة لا تحتاجه ولا يجب أن تراه.
- ✅ المتغير الوحيد المسموح في Vercel: `VITE_API_BASE_URL` (اختياري).
- 🔁 أي تعديل على الواجهة ⇒ `npx vercel --prod` مرة أخرى (أو ادفع إلى Git).
