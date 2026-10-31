# Postora

<div dir="rtl">

> 📘 **تريد التشغيل فورًا؟** ابدأ من **[RUN_GUIDE.md](RUN_GUIDE.md)** — دليل كامل خطوة بخطوة
> من تنزيل الملف حتى النشر الحقيقي في قناتك (Windows + Linux + Render + Vercel).

**منظومة نشر احترافية على تلجرام: تكتب بـ Markdown، تعاين كما ستظهر بالضبط، ثم تنشر في قناتك.**

بوت تلجرام + تطبيق تلجرام مصغر (Mini App) بمحرك Markdown مشترك، خلفية Node.js/Express، وقاعدة بيانات PostgreSQL.

[![Node](https://img.shields.io/badge/Node.js-20%20LTS-339933?logo=node.js&logoColor=white)](https://nodejs.org)
[![JavaScript](https://img.shields.io/badge/JavaScript-ESM-f7df1e?logo=javascript&logoColor=black)](#)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-15%2B-4169e1?logo=postgresql&logoColor=white)](https://www.postgresql.org)
[![Tests](https://img.shields.io/badge/tests-166%20passing-22a06b)](#-%D8%A7%D9%84%D8%A7%D8%AE%D8%AA%D8%A8%D8%A7%D8%B1%D8%A7%D8%AA)

</div>

---

## جدول المحتويات

0. [🚀 دليل التشغيل الكامل](RUN_GUIDE.md)
1. [ما هو Postora](#-ما-هو-postora)
2. [الميزات](#-الميزات)
3. [التقنيات](#-التقنيات)
4. [هيكل المشروع](#-هيكل-المشروع)
5. [التثبيت على Windows من الصفر](#-التثبيت-على-windows-من-الصفر)
6. [التشغيل](#-التشغيل)
7. [متغيرات البيئة](#-متغيرات-البيئة)
8. [الاختبارات](#-الاختبارات)
9. [النشر](#-النشر)
10. [الأمان](#-الأمان)
11. [استكشاف الأخطاء](#-استكشاف-الأخطاء)
12. [الميزات والحدود](#-الميزات-والحدود)

---

## 🎯 ما هو Postora

Postora يحل مشكلة محددة: **من يكتب محتوى طويلًا بـ Markdown ويحتاج نشره في قنوات تلجرام** — بينما تلجرام لا يدعم Markdown القياسي ولا العناوين ولا القوائم ولا الجداول.

الحل:

- **محرك تحويل حقيقي** يفهم قيود Telegram Bot API ويحوّل كل تنسيق إلى أقرب تمثيل مدعوم، مع تحذيرك صراحةً عن أي تحويل.
- **معاينة مطابقة**: ما تراه في المعاينة هو **حرفيًا** ما سيُنشر (نفس المحرك، نفس النص، نفس الكيانات، نفس التقسيم).
- **أمان النشر**: فحص حي لصلاحياتك وصلاحيات البوت في القناة عند كل نشر، ومنع النشر المزدوج.

---

## ✨ الميزات

### بوت تلجرام (`@Postora_1bot`)

| الميزة | الحالة |
|---|---|
| `/start` ترحيب + شرح خطوات الربط | ✅ |
| `/help` قائمة الأوامر | ✅ |
| `/channels` عرض القنوات وحالة صلاحيات البوت | ✅ |
| `/status` حالة آخر عملية نشر | ✅ |
| `/cancel` إلغاء العملية المعلّقة | ✅ |
| `/language` تبديل عربي/إنجليزي | ✅ |
| استقبال ملفات `.md` مع تحقق (امتداد، حجم، ترميز UTF-8، ثنائي، فارغ) | ✅ |
| معاينة كرسائل تلجرام حقيقية في الخاص | ✅ |
| أزرار تأكيد/إلغاء + منع الضغط المزدوج | ✅ |
| نشر متعدد الرسائل مع تسجيل ما نجح عند الفشل الجزئي | ✅ |
| فحص حي للصلاحيات قبل كل نشر | ✅ |
| رسائل خطأ عربية واضحة لكل حالة | ✅ |

### تطبيق تلجرام المصغر

| الميزة | الحالة |
|---|---|
| لوحة تحكم بإحصاءات | ✅ |
| محرر Markdown + شريط أدوات | ✅ |
| معاينة مباشرة مطابقة لتلجرام | ✅ |
| إدارة المسودات (إنشاء/فتح/حذف) | ✅ |
| إدارة القنوات (ربط/فحص/فصل) | ✅ |
| اختيار القناة المستهدفة | ✅ |
| زر النشر + عرض النتائج والأخطاء | ✅ |
| عربي/إنجليزي + RTL/LTR كامل | ✅ |
| متوافق مع ثيم تلجرام (فاتح/داكن) | ✅ |
| متجاوب للهاتف أولًا | ✅ |

### محرك Markdown

| الميزة | السلوك في تلجرام |
|---|---|
| `**عريض**`, `*مائل*`, `~~مشطوب~~` | كيانات `bold`, `italic`, `strikethrough` |
| `` `كود` `` | `code` |
| ```` ```lang ```` | `pre` + `language` |
| `[نص](رابط)` | `text_link` (مع قائمة بيضاء للمخططات) |
| `> اقتباس` | `blockquote` |
| `# عنوان` | سطر **عريض** + تحذير |
| `- قائمة` / `1. قائمة` | `• ` / `1. ` + تحذير |
| قوائم متداخلة | مسافات بادئة + تحذير |
| جدول | كتلة `pre` + تحذير |
| `![صورة]` | `🖼 نص بديل` + تحذير |
| `---` | سطر `──────────` |
| HTML خام | يُعرض كنص مهروب (لا تنفيذ) |
| نص > 4096 حرف | تقسيم ذكي على حدود الكتل مع إعادة فتح الكيانات |

---

## 🧰 التقنيات

**Backend:** Node.js 20 LTS · Express 5 · Telegraf 4 · PostgreSQL 17 (`pg` + SQL مباشر) · Zod 4 · markdown-it 15 · JWT (`jose`) · Pino · Helmet

**Frontend:** React 19 · Vite 8 · Telegram WebApp SDK · CSS مخصص (بلا مكتبات UI)

**الاختبارات:** Vitest 3 · Supertest · Puppeteer (اختبار واجهة حقيقي) · خادم تلجرام وهمي محلي

**JavaScript فقط — بلا TypeScript.**

---

## 📁 هيكل المشروع

```
postora/
├─ apps/
│  ├─ server/                     # Backend: Express + Telegraf + API
│  │  ├─ src/
│  │  │  ├─ index.js              # نقطة التشغيل
│  │  │  ├─ app.js                # بناء Express (قابل للاختبار)
│  │  │  ├─ container.js          # تركيب الخدمات (DI)
│  │  │  ├─ config/env.js         # تحقق Zod من متغيرات البيئة
│  │  │  ├─ api/                  # مسارات HTTP + middleware
│  │  │  ├─ bot/                  # أوامر/تدفقات/لوحات أزرار تلجرام
│  │  │  ├─ services/             # منطق العمل (لا SQL، لا HTTP)
│  │  │  ├─ db/                   # pool + repositories + migrations
│  │  │  ├─ telegram/             # بوابة Bot API + initData + ترميز الأخطاء
│  │  │  ├─ files/                # تحقق وتنزيل ملفات .md
│  │  │  ├─ errors/               # AppError موحّد
│  │  │  └─ utils/                # logger, crypto
│  │  └─ tests/                   # 93 اختبارًا (وحدة + تكامل + بوت)
│  └─ miniapp/                    # Frontend: React Mini App
│     ├─ vercel.json              # نشر Vercel (rewrites + headers)
│     └─ src/
│        ├─ components/           # محرر، معاينة، قنوات، UI
│        ├─ pages/                # لوحة، محرر، مسودات، قنوات
│        ├─ context/              # حالة التطبيق
│        ├─ lib/                  # API client + Telegram SDK + المحرك
│        ├─ i18n/                 # ar + en
│        └─ styles/               # tokens + base + app
├─ packages/
│  ├─ markdown-engine/            # ★ محرك التحويل (نقي، بلا I/O) + 50 اختبارًا
│  └─ shared/                     # رموز أخطاء، حدود، مخططات Zod + 12 اختبارًا
├─ scripts/
│  ├─ dev.js                      # تشغيل كامل (خادم + واجهة + تلجرام وهمي)
│  ├─ migrate.js                  # تشغيل الترحيلات
│  ├─ ensure-db.sh                # تهيئة PostgreSQL (Linux/macOS)
│  ├─ verify.sh                   # تحقق شامل (11 فحصًا) — ابدأ من هنا
│  ├─ deploy-vercel.mjs           # يضبط نطاق الخادم في vercel.json
│  ├─ fake-telegram-server.js     # خادم تلجرام وهمي للتطوير
│  └─ ui-smoke-test.js            # اختبار واجهة فعلي بـ Chromium
├─ RUN_GUIDE.md                   # ★ دليل التشغيل الكامل (ابدأ من هنا)
├─ docs/                          # architecture, deployment, security, render, vercel
├─ docker-compose.yml          # نشر كامل بـ Docker
├─ render.yaml                 # نشر الخادم على Render (Blueprint)
└─ .env.example
```

---

## 🪟 التثبيت على Windows من الصفر

> 📘 **للحصول على الدليل الأشمل (Windows + Linux + النشر + كل القيم المطلوبة)، راجع [RUN_GUIDE.md](RUN_GUIDE.md).**
> ما يلي ملخص سريع.

> هذه الخطوات مكتوبة لمن لم يثبّت شيئًا بعد. كل أمر مكتوب حرفيًا.

### 1) تثبيت Node.js 20 LTS

1. افتح <https://nodejs.org/en/download> ← اختر **Windows Installer (.msi)** لإصدار **LTS**.
2. أثناء التثبيت أبقِ خيار **"Add to PATH"** مفعّلًا.
3. افتح **PowerShell** جديدًا وتحقق:

```powershell
node -v     # يجب أن يبدأ بـ v20 أو أعلى LTS
npm -v
```

### 2) تثبيت Git

1. من <https://git-scm.com/download/win> نزّل الإصدار 64-bit.
2. أثناء التثبيت اترك الإعدادات الافتراضية.

```powershell
git --version
```

### 3) تثبيت PostgreSQL

**الطريقة الأولى (موصى بها): مثبّت رسمي**

1. من <https://www.postgresql.org/download/windows/> نزّل **PostgreSQL 17 Installer**.
2. أثناء التثبيت:
   - احفظ كلمة سر مستخدم `postgres` في مكان آمن.
   - اترك المنفذ **5432**.
3. بعد التثبيت، افتح **SQL Shell (psql)** من قائمة ابدأ واضغط Enter لكل الأسئلة (ثم كلمة سر postgres).
4. أنشئ المستخدم وقاعدتي البيانات:

```sql
CREATE ROLE postora LOGIN PASSWORD 'postora_dev_pw';
CREATE DATABASE postora_dev OWNER postora;
CREATE DATABASE postora_test OWNER postora;
\q
```

**الطريقة الثانية: Docker Desktop**

```powershell
docker run -d --name postora-db -e POSTGRES_USER=postora -e POSTGRES_PASSWORD=postora_dev_pw -e POSTGRES_DB=postora_dev -p 5432:5432 postgres:17-alpine
# قاعدة الاختبار
docker exec -it postora-db createdb -U postora postora_test
```

### 4) تنزيل المشروع

```powershell
cd $HOME
git clone <رابط-المستودع> postora
cd postora
```

أو إن وصلك المشروع كملفات: فك الضغط ثم `cd` إلى المجلد.

### 5) تثبيت التبعيات

```powershell
npm install
```

> المشروع Monorepo بـ npm workspaces — أمر واحد يثبّت كل الحزم.

### 6) إعداد متغيرات البيئة

```powershell
Copy-Item .env.example .env
notepad .env
```

املأ **ثلاثة** قيم على الأقل:

| المتغير | القيمة |
|---|---|
| `BOT_TOKEN` | التوكن من [@BotFather](https://t.me/BotFather) |
| `DATABASE_URL` | `postgresql://postora:postora_dev_pw@127.0.0.1:5432/postora_dev` |
| `JWT_SECRET` | سلسلة عشوائية ≥ 32 محرفًا (انظر أدناه) |

توليد `JWT_SECRET`:

```powershell
node -e "console.log(require('crypto').randomBytes(48).toString('base64url'))"
```

### 7) تشغيل الترحيلات

```powershell
npm run migrate
```

المتوقع:

```
✔ Migrations complete!
```

تحقق (اختياري):

```powershell
psql -U postora -h 127.0.0.1 -d postora_dev -c "\dt"
```

يجب أن ترى الجداول: `users`, `channels`, `channel_members`, `drafts`, `publications`, `publish_logs`.

---

## ▶️ التشغيل

### الخيار أ — تجربة كاملة **بدون** توكن تلجرام حقيقي

> **سلوك مقصود:** إن كان `BOT_TOKEN` فارغًا أو قيمة المثال (`YOUR_...`)، يُقلع الخادم
> والـ API والواجهة normally، ويُسجَّل `BOT DISABLED` — البوت وحده لا يعمل.
> هذا يسمح بتشغيل المشروع فور تنزيله قبل إنشاء توكن.

مفيد لتجربة كل شيء محليًا (بما فيه البوت) قبل إنشاء التوكن:

```powershell
$env:FAKE_TELEGRAM=1
npm run dev
```

هذا يشغّل ثلاثة أشياء:
- خادم تلجرام وهمي على `8081`
- الـ Backend على `3000`
- الـ Mini App على `5173`

ثم:
1. افتح <http://localhost:5173> (سترى شاشة "افتح من تلجرام" — طبيعي في المتصفح).
2. لتجربة الواجهة كأنها داخل تلجرام: `node scripts/ui-smoke-test.js` يفتحها بمتصفح ويحقن `initData` موقّعًا.

### الخيار ب — التشغيل الحقيقي

```powershell
npm run dev
```

| الخدمة | العنوان |
|---|---|
| Backend API | <http://localhost:3000> |
| فحص الحياة | <http://localhost:3000/health> |
| Mini App | <http://localhost:5173> |

**تحقق أن البوت يعمل:** افتح [@Postora_1bot](https://t.me/Postora_1bot) وأرسل `/start`.

### أوامر أخرى

```powershell
npm run dev:server      # الخادم فقط
npm run dev:miniapp     # الواجهة فقط
npm run build           # بناء الواجهة للإنتاج
npm test                # كل الاختبارات
npm run test:engine     # اختبارات المحرك فقط
npm run test:server     # اختبارات الخادم فقط
npm run migrate:down    # تراجع خطوة ترحيل واحدة
```

---

## ⚙️ متغيرات البيئة

| المتغير | إلزامي | الوصف |
|---|---|---|
| `BOT_TOKEN` | ✅ | توكن البوت من BotFather — **لا تشاركه** |
| `DATABASE_URL` | ✅ | سلسلة اتصال PostgreSQL |
| `JWT_SECRET` | ✅ | سر توقيع الجلسات (≥32 محرفًا) |
| `TEST_DATABASE_URL` | — | قاعدة الاختبارات (افتراضيًا `postora_test`) |
| `PORT` | — | منفذ الخادم (افتراضي 3000) |
| `NODE_ENV` | — | `development` / `test` / `production` |
| `BOT_MODE` | — | `polling` (تطوير) أو `webhook` (إنتاج) |
| `WEBHOOK_URL` / `WEBHOOK_SECRET` | عند webhook | رابط HTTPS + سلسلة سرية |
| `CORS_ORIGINS` | — | أصول مسموحة مفصولة بفواصل |
| `MINIAPP_URL` | — | رابط الـ Mini App (يُظهر زر الفتح في البوت) |
| `MAX_UPLOAD_BYTES` | — | أقصى حجم لملف `.md` (افتراضي 262144 = 256KB) |
| `MAX_CONTENT_CHARS` | — | أقصى طول للمقال (افتراضي 100000) |
| `MAX_PUBLISH_MESSAGES` | — | أقصى عدد رسائل لمنشور واحد (افتراضي 40) |
| `LOG_LEVEL` | — | `info` / `debug` / `silent` |

جميع المتغيرات مشروحة في [`.env.example`](.env.example).

---

## 🧪 الاختبارات

```powershell
npm test
```

النتائج الفعلية (آخر تشغيل):

| الحزمة | الملفات | الاختبارات |
|---|---|---|
| `@postora/markdown-engine` | 2 | **50** ✅ |
| `@postora/shared` | 1 | **12** ✅ |
| `@postora/server` | 7 | **93** ✅ |
| **الإجمالي** | **10** | **155** ✅ |

اختبار الواجهة الحقيقي (يحتاج Chromium + الخادم يعمل):

```powershell
node scripts/ui-smoke-test.js
# 9/9 خطوة ناجحة — اللقطات في tests-artifacts/
```

التفاصيل الكاملة في [`TEST_RESULTS.md`](TEST_RESULTS.md).

### تحقق شامل بأمر واحد

```bash
bash scripts/verify.sh
```

يفحص المتطلبات ← التبعيات ← الترحيلات ← الاختبارات ← البناء ← إقلاع الخادم و`/health`.
آخر تشغيل: **11 ناجح، 0 فاشل**. النتيجة النهائية: `✔ المشروع سليم. شغّله بـ: npm run dev`

---

## 🚀 النشر

| الهدف | الدليل |
|---|---|
| نشر **الخادم** على Render (Backend + PostgreSQL) | **[docs/DEPLOY-RENDER.md](docs/DEPLOY-RENDER.md)** ← `render.yaml` جاهز |
| نشر Mini App على **Vercel** | **[docs/DEPLOY-VERCEL.md](docs/DEPLOY-VERCEL.md)** ← ملف `vercel.json` جاهز |
| نشر الخادم + Docker + HTTPS + Webhook | [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md) |
| إعداد BotFather (Menu Button / الأوامر) | [EXTERNAL_SETUP.md](EXTERNAL_SETUP.md) |

**أسرع مسار للنشر الكامل:**

```bash
# 1) الخادم: من لوحة Render → New → Blueprint → اختر مستودعك (render.yaml)
#    ثم أضف BOT_TOKEN عند الطلب.

# 2) الواجهة:
node scripts/deploy-vercel.mjs https://postora-api.onrender.com
cd apps/miniapp && npx vercel --prod

# 3) BotFather → Bot Settings → Menu Button → نطاق Vercel
```

الملخص:

```bash
cp .env.example .env    # عبّئ القيم بالإنتاج
docker compose up -d --build
docker compose exec backend node scripts/migrate.js up
```

---

## 🔒 الأمان

| الضابط | التنفيذ |
|---|---|
| لا توكن في الكود/الواجهة | التوكن في `.env` فقط؛ لا يوجد أي endpoint يُرجعه |
| التحقق من `initData` | HMAC-SHA256 رسمي على الخادم + فحص `auth_date` |
| لا ثقة بالعميل | الهوية من initData/JWT؛ `user_id` من الطلب يُتجاهل |
| فحص صلاحيات حي | `getChatMember` في كل نشر (لا اعتماد على المخزَّن) |
| منع تكرار النشر | `idempotency_key` فريد + انتقال حالة ذرّي `pending→publishing` |
| حقن SQL | Parameterized queries فقط |
| HTML خبيث | `markdown-it({html:false})` + هروب `& < >` + قائمة بيضاء للوسوم |
| Rate limiting | في الذاكرة لكل مسار + حدّ داخلي لنداءات تلجرام |
| Webhook مزيف | مقارنة `secret_token` في كل طلب |
| تسريب في السجلات | Pino redaction للمفاتيح و initData و JWT |

تفاصيل نموذج التهديد: [docs/SECURITY.md](docs/SECURITY.md).

---

## 🔧 استكشاف الأخطاء

| المشكلة | الحل |
|---|---|
| `إعدادات البيئة غير صالحة` | تحقق من `.env` — الرسالة تذكر اسم الحقل الناقص |
| `database is not reachable` | هل PostgreSQL يعمل؟ تحقق من `DATABASE_URL` |
| البوت لا يرد | تحقق من `BOT_TOKEN`، وشغّل `curl http://localhost:3000/health` |
| `BOT DISABLED` في السجلات | `BOT_TOKEN` ما زال قيمة المثال — ضع توكنًا حقيقيًا وأعد التشغيل (الـ API يعمل بلا بوت) |
| `BOT TOKEN REJECTED (401)` | التوكن خاطئ أو مُبطَل — أنشئ توكنًا جديدًا من BotFather (الخادم لا ينهار) |
| `BOT CONFLICT (409)` | نسخة أخرى تعمل بنفس التوكن — أوقفها أو اتصل `deleteWebhook` |
| **البوت لا يرد ولا يوجد أي خطأ في السجل** | ⚠️ تحقق أن `TELEGRAM_API_BASE_URL` **معلّق** في `.env`. إن كان موجّهًا لخادم وهمي فالبوت يتحدث معه لا مع تلجرام الحقيقي — يعمل بلا أخطاء ولا يستقبل شيئًا |
| الواجهة ترى "افتح من تلجرام" | طبيعي في المتصفح — استخدم `scripts/ui-smoke-test.js` أو افتحها من تلجرام |
| `ERR_ERL_KEY_GEN_IPV6` | مُصلح — استخدم `ipKeyGenerator` (موجود في الكود) |
| `relation "users" does not exist` | شغّل `npm run migrate` |
| فشل النشر بـ `CHANNEL_BOT_NOT_ADMIN` | أضف البوت مسؤولًا في القناة بصلاحية "نشر الرسائل" |

---

## 📋 الميزات والحدود

القائمة المرجعية الكاملة (ما اكتمل، وما لم يُختبر على تلجرام، وما ينقص) في
**[`docs/features-and-limitations.md`](docs/features-and-limitations.md)**.

> ✅ **مُتحقَّق منه على تلجرام الحقيقي (2026-10-30): 19/19 فحصًا ناجحًا** — التوكن، استقبال التحديثات،
> ربط القناة، والنشر الفعلي في قناة حقيقية. التفاصيل: [`docs/REAL-TELEGRAM-RESULTS.md`](docs/REAL-TELEGRAM-RESULTS.md).

**باختصار:**

| البند | العدد |
|---|---|
| ميزات مكتملة ومُختبرة | 62 |
| فحوص ناجحة على تلجرام الحقيقي | 19/19 |
| عناصر لم تُختبر على تلجرام الحقيقي | 6 (WebView، Webhook، Docker) |
| حدود تلجرام غير قابلة للتجاوز | 8 (موثقة ومُعالجة بتحذيرات) |
| حدود معمارية متعمدة | 8 (لها مسار تحسين واضح) |

### أبرز الحدود التي يجب أن تعرفها قبل البدء

1. **العناوين والقوائم والجداول والصور** غير مدعومة في Telegram Bot API — Postora يحوّلها لأقرب شكل مدعوم **ويحذّرك صراحةً** قبل النشر.
2. **النشر يتم فورًا** — لا جدولة مؤجلة.
3. **Rate limiting في الذاكرة** — كافٍ لنسخة واحدة من الخادم (للتوسع: انظر `docs/DEPLOYMENT.md` §9).
4. **لا تحرير بعد النشر** من داخل التطبيق.

---

## 📄 الترخيص

خاص — جميع الحقوق محفوظة.
