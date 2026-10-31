# 🚀 دليل تشغيل Postora — الكامل

> **هذا الدليل هو المرجع الوحيد لتشغيل المشروع.** من تنزيل الملف المضغوط حتى نشر البوت
> في قناتك الحقيقية، مع كل خطوة وكل أمر وكل قيمة مطلوبة.
>
> ✅ كل ما مكتوب هنا **مُختبَر فعليًا** — لا خطوة نظرية.
> 🕐 **الوقت الكلي:** ~30 دقيقة للتشغيل المحلي · ~45 دقيقة للنشر الكامل.

---

## 📑 المحتويات

- [الجزء 1: ما تحتاجه قبل البدء](#الجزء-1-ما-تحتاجه-قبل-البدء)
- [الجزء 2: التشغيل على Windows (خطوة بخطوة)](#الجزء-2-التشغيل-على-windows-خطوة-بخطوة)
- [الجزء 3: التشغيل على Linux / macOS](#الجزء-3-التشغيل-على-linux--macos)
- [الجزء 4: تشغيل المكوّنات منفصلة](#الجزء-4-تشغيل-المكوّنات-منفصلة)
- [الجزء 5: النشر على الإنترنت (Render + Vercel)](#الجزء-5-النشر-على-الإنترنت-render--vercel)
- [الجزء 6: قائمة "ما يجب أن تعمله وتضيفه" كاملة](#الجزء-6-قائمة-ما-يجب-أن-تعمله-وتضيفه-كاملة)
- [الجزء 7: التحقق النهائي](#الجزء-7-التحقق-النهائي)
- [الجزء 8: استكشاف الأخطاء](#الجزء-8-استكشاف-الأخطاء)

---

# الجزء 1: ما تحتاجه قبل البدء

## 1.1 الحد الأدنى الإلزامي (بدونه لا يعمل شيء)

| # | المتطلب | كيف تحصل عليه | الوقت |
|---|---|---|---|
| 1 | **Node.js 20 LTS** | <https://nodejs.org> → LTS Installer | 5 د |
| 2 | **PostgreSQL 15+** | <https://www.postgresql.org/download/> | 10 د |
| 3 | **BOT_TOKEN** | [@BotFather](https://t.me/BotFather) → `/myapps` → API Token | 2 د |
| 4 | **JWT_SECRET** | `node -e "console.log(require('crypto').randomBytes(48).toString('base64url'))"` | 10 ث |

> ✅ **اختُبر:** المشروع يعمل بـ **هذه الثلاثة فقط** في `.env`
> (`BOT_TOKEN`, `DATABASE_URL`, `JWT_SECRET`) — كل الباقي له قيم افتراضية.

## 1.2 مطلوب للتجربة الكاملة (النشر في قناة)

| # | المتطلب | كيف |
|---|---|---|
| 5 | قناة تلجرام | أنشئ قناة تجريبية (خاصة أو عامة) |
| 6 | البوت مسؤول في القناة | Administrators → Add → `@Postora_1bot` → فعّل **Post Messages** |

## 1.3 مطلوب للنشر على الإنترنت (Mini App داخل تلجرام)

| # | المتطلب | كيف |
|---|---|---|
| 7 | حساب GitHub | لرفع المشروع (Render ينشر من Git) |
| 8 | حساب Render (مجاني) | للخادم + قاعدة البيانات |
| 9 | حساب Vercel (مجاني) | للواجهة |
| 10 | **ربط BotFather** | Menu Button → نطاق Vercel |

## 1.4 اختياري

| # | المتطلب | لماذا |
|---|---|---|
| 11 | Docker Desktop | إن أردت نشرًا بـ `docker-compose` بدل Render |
| 12 | Chromium | لتشغيل اختبار الواجهة `ui-smoke-test.js` |

---

# الجزء 2: التشغيل على Windows (خطوة بخطوة)

> كل أمر مكتوب حرفيًا. افتح **PowerShell** جديدًا بعد كل تثبيت.

## 2.1 تثبيت Node.js

1. افتح <https://nodejs.org/en/download>
2. اختر **Windows Installer (.msi)** لإصدار **LTS**
3. أثناء التثبيت أبقِ **"Add to PATH"** مفعّلًا
4. تحقق:

```powershell
node -v
npm -v
```

**المتوقع:** `v20.x.x` أو أعلى · `10.x.x` أو أعلى

## 2.2 تثبيت PostgreSQL

1. من <https://www.postgresql.org/download/windows/> نزّل **PostgreSQL 17 Installer**
2. أثناء التثبيت:
   - **كلمة سر `postgres`:** احفظها في مكان آمن
   - **المنفذ:** اتركه `5432`
3. بعد التثبيت: ابدأ ← **SQL Shell (psql)** ← اضغط Enter لكل سؤال ← أدخل كلمة سر `postgres`
4. أنشئ المستخدم وقاعدتي البيانات:

```sql
CREATE ROLE postora LOGIN PASSWORD 'postora_dev_pw';
CREATE DATABASE postora_dev OWNER postora;
CREATE DATABASE postora_test OWNER postora;
\q
```

**المتوقع:** `CREATE ROLE` ثم `CREATE DATABASE` مرتين

## 2.3 فك ضغط المشروع

```powershell
# انقل postora-1.0.0.zip إلى مجلد العمل
cd $HOME
Expand-Archive -Path "$HOME\Downloads\postora-1.0.0.zip" -DestinationPath "$HOME\Projects" -Force
cd "$HOME\Projects\postora"
```

تحقق من المحتوى:

```powershell
dir
```

**المتوقع:** `README.md` · `package.json` · `apps\` · `packages\` · `docs\` · `scripts\`

## 2.4 تثبيت التبعيات

```powershell
npm install
```

**المدة:** 1–3 دقائق · **المتوقع:** `added N packages` بلا `ERR!`

> 📌 المشروع **monorepo** — أمر واحد يثبّت كل الحزم (server + miniapp + packages).

## 2.5 إنشاء ملف `.env`

```powershell
Copy-Item .env.example .env
notepad .env
```

**املأ هذه الأسطر الثلاثة فقط** (الباقي اتركه كما هو):

```env
BOT_TOKEN=123456789:AAH...التوكن-من-BotFather
DATABASE_URL=postgresql://postora:postora_dev_pw@127.0.0.1:5432/postora_dev
JWT_SECRET=السلسلة-العشوائية-التي-ولّدتها
```

توليد `JWT_SECRET` إن لم تفعل:

```powershell
node -e "console.log(require('crypto').randomBytes(48).toString('base64url'))"
```

> 🔒 **لا تضع التوكن في أي ملف آخر.** `.env` مستثنى في `.gitignore`.

**اختياري لكن مفيد** — تأكد أن هذين السطرين **معطّلان** (بعلامة `#`):

```env
# TELEGRAM_API_BASE_URL=
# WEBHOOK_URL=
```

## 2.6 تشغيل الترحيلات

```powershell
npm run migrate
```

**المتوقع:**

```
▶ تشغيل الترحيلات: up
...
Migrations complete!
```

تحقق أن الجداول أُنشئت:

```powershell
psql -U postora -h 127.0.0.1 -d postora_dev -c "\dt"
```

**المتوقع:** `users` · `channels` · `channel_members` · `drafts` · `publications` · `publish_logs` · `pgmigrations`

## 2.7 تشغيل المشروع

```powershell
npm run dev
```

**المتوقع في الطرفية:**

```
[server] {"level":30,"msg":"database connected"}
[server] {"level":30,"port":3000,"msg":"http server listening"}
[server] {"level":30,"mode":"polling","msg":"bot started (polling)"}
[miniapp] VITE ready in 400 ms
[miniapp] ➜  Local: http://localhost:5173/
```

## 2.8 التحقق

افتح طرفية **أخرى** (اترك `npm run dev` يعمل):

```powershell
# 1) الخادم حيّ؟
curl http://localhost:3000/health
```

**المتوقع:** `{"ok":true,"service":"postora","version":"1.0.0","db":"up",...}`

```powershell
# 2) الواجهة تعمل؟
curl http://localhost:5173
```

**المتوقع:** HTML يحتوي `<div id="root">`

```powershell
# 3) الحماية تعمل؟ (يجب أن يُرفض)
curl http://localhost:3000/api/me
```

**المتوقع:** `{"ok":false,"error":{"code":"AUTH_MISSING_INIT_DATA",...}}` ← هذا **صحيح**

## 2.9 اختبار البوت

1. افتح [@Postora_1bot](https://t.me/Postora_1bot)
2. أرسل `/start`

**المتوقع:** رسالة ترحيب عربية فيها اسمك وزر **"فتح Postora"**

3. أرسل `/help` ← قائمة الأوامر
4. أرسل `/channels` ← قائمة فارغة (لم تربط قناة بعد)

## 2.10 ربط قناة والنشر

1. في تلجرام: افتح قناتك ← **Administrators** ← **Add Administrator** ← `@Postora_1bot`
2. **فعّل "Post Messages"** (نشر الرسائل) ← احفظ
3. أرسل للبوت `/channels`
4. البوت سيسألك عن القناة ← أرسل `@اسم_قناتك` (أو المعرّف `-100...`)

**المتوقع:** `✅ تم ربط القناة: اسم قناتك`

5. أنشئ ملف `article.md` على سطح المكتب بمحتوى:

```markdown
# مقال تجريبي

هذا نص **عريض** وهذا *مائل* وهذا `كود`.

> اقتباس

- عنصر أول
- عنصر ثانٍ
```

6. أرسل الملف إلى البوت (attach → Document)

**المتوقع:** البوت يرسل **معاينة كرسائل تلجرام حقيقية** + أزرار **تأكيد / إلغاء**

7. اضغط **تأكيد**

**المتوقع:** `✅ تم النشر بنجاح — 1 رسالة` · وافتح قناتك لترى المنشور

8. تحقق من قاعدة البيانات:

```powershell
psql -U postora -h 127.0.0.1 -d postora_dev -c "SELECT status, rendered_messages_count, telegram_message_ids FROM publications ORDER BY created_at DESC LIMIT 3;"
```

**المتوقع:** `published | 1 | {1234}`

---

# الجزء 3: التشغيل على Linux / macOS

نفس الخطوات، بأوامر مختلفة:

## 3.1 المتطلبات

**Ubuntu/Debian:**

```bash
sudo apt update
sudo apt install -y curl git postgresql
# Node 20 عبر nvm
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.40.1/install.sh | bash
source ~/.bashrc
nvm install 20 && nvm use 20
```

**macOS (Homebrew):**

```bash
brew install node@20 postgresql@17
brew services start postgresql@17
```

## 3.2 قاعدة البيانات

```bash
sudo -u postgres psql -c "CREATE ROLE postora LOGIN PASSWORD 'postora_dev_pw';"
sudo -u postgres psql -c "CREATE DATABASE postora_dev OWNER postora;"
sudo -u postgres psql -c "CREATE DATABASE postora_test OWNER postora;"
```

أو استخدم السكربت الجاهز:

```bash
bash scripts/ensure-db.sh
```

## 3.3 بقية الخطوات

```bash
unzip postora-1.0.0.zip
cd postora
npm install
cp .env.example .env
nano .env          # املأ BOT_TOKEN, DATABASE_URL, JWT_SECRET
npm run migrate
npm run dev
```

---

# الجزء 4: تشغيل المكوّنات منفصلة

## 4.1 كل شيء معًا (المعتاد)

```bash
npm run dev
```

يشغّل: الخادم (3000) + الواجهة (5173) + البوت.

## 4.2 الخادم فقط

```bash
npm run dev:server
```

يحتاج `DATABASE_URL` و`BOT_TOKEN` · يعمل على `http://localhost:3000`

## 4.3 الواجهة فقط

```bash
npm run dev:miniapp
```

يعمل على `http://localhost:5173` · يمرّر `/api` إلى المنفذ 3000 (يجب أن يكون الخادم يعمل).

**لتوجيه الواجهة لخادم آخر:**

```bash
VITE_API_TARGET=http://192.168.1.50:3000 npm run dev:miniapp
```

## 4.4 البوت وحده (بدون واجهة)

```bash
npm run dev:server
```

البوت يعمل تلقائيًا مع الخادم — لا أمر منفصل.

## 4.5 بدون توكن تلجرام (للتجربة فقط)

```bash
FAKE_TELEGRAM=1 npm run dev
```

يشغّل **خادم تلجرام وهمي** على المنفذ 8081 — لتجربة كل شيء بلا حساب حقيقي.

> ⚠️ في هذا الوضع **لا يصلك شيء في تلجرام** — التحديثات الوهمية تُحقن عبر `/fake/inject-update`.

## 4.6 الأوامر المتاحة كاملة

```bash
npm run dev              # الخادم + الواجهة + البوت
npm run dev:server       # الخادم فقط
npm run dev:miniapp      # الواجهة فقط
npm run build            # بناء الواجهة للإنتاج → apps/miniapp/dist
npm test                 # كل الاختبارات (155)
npm run test:engine      # اختبارات محرك Markdown (50)
npm run test:server      # اختبارات الخادم (93)
npm run migrate          # تشغيل الترحيلات
npm run migrate:down     # تراجع خطوة واحدة
npm run verify           # تحقق شامل (11 فحصًا)
npm run lint             # ESLint
```

## 4.7 اختبار الواجهة بمتصفح حقيقي

```bash
# 1) شغّل المشروع في طرفية
npm run dev

# 2) في طرفية أخرى
node scripts/ui-smoke-test.js
```

**المتوقع:** `9/9 خطوة ناجحة` + لقطات في `tests-artifacts/`

> يحتاج Chromium: `sudo apt install chromium` · أو `CHROME_PATH=... node scripts/ui-smoke-test.js`

---

# الجزء 5: النشر على الإنترنت (Render + Vercel)

> لماذا؟ لأن **Mini App لا يعمل إلا على HTTPS**، وتلجرام يشترطه في BotFather.
> البوت نفسه يعمل على جهازك — لكن التطبيق المصغّر يحتاج استضافة.

## 5.1 المخطط

```
تلجرام ──webhook──► postora-api.onrender.com   ← الخادم + البوت + PostgreSQL
                          ▲
تلجرام WebView ─► postora.vercel.app ──/api/*──┘  ← الواجهة
```

## 5.2 الخادم على Render

**أ. ارفع المشروع إلى GitHub:**

```bash
cd postora
git init
git add .
git commit -m "Postora"
git branch -M main
git remote add origin https://github.com/<اسمك>/postora.git
git push -u origin main
```

> ✅ تأكد أن `.env` غير مرفوع: `git status --porcelain | grep .env` يجب أن يكون فارغًا.

**ب. أنشئ Blueprint:**

1. <https://dashboard.render.com> ← **New** ← **Blueprint**
2. اختر مستودع `postora`
3. Render يقرأ `render.yaml` ← اضغط **Apply**
4. أدخل القيم المطلوبة:

| المتغير | القيمة |
|---|---|
| `BOT_TOKEN` | توكنك من BotFather |
| `CORS_ORIGINS` | `https://your-app.vercel.app` (أو اتركه الآن وأضفه لاحقًا) |
| `MINIAPP_URL` | نفس النطاق |

**ج. انتظر النشر (~5 دقائق)** وتابع **Logs**.

**المتوقع:**

```
{"env":"production","botMode":"webhook","msg":"starting postora"}
{"msg":"database connected"}
{"msg":"http server listening"}
{"mode":"webhook","msg":"bot webhook configured"}
{"msg":"bot started"}
```

**د. تحقق:**

```bash
curl https://postora-api.onrender.com/health
# {"ok":true,"db":"up",...}
```

> 📘 التفاصيل الكاملة: `docs/DEPLOY-RENDER.md`

## 5.3 الواجهة على Vercel

```bash
node scripts/deploy-vercel.mjs https://postora-api.onrender.com
cd apps/miniapp
npx vercel --prod
```

أول مرة سيسألك:
- **Set up and deploy?** ← `Y`
- **Link to existing project?** ← `N`
- **Project name?** ← `postora`
- **In which directory?** ← `./` (Enter)

**ستحصل على:** `https://postora-abc123.vercel.app`

## 5.4 اربط الاثنين

**في Render** ← `postora-api` ← **Environment**:

```env
CORS_ORIGINS = https://postora-abc123.vercel.app
MINIAPP_URL  = https://postora-abc123.vercel.app
```

← **Save Changes** (يعيد النشر تلقائيًا)

## 5.5 اربط Mini App بالبوت

1. [@BotFather](https://t.me/BotFather) ← `/mybots`
2. `@Postora_1bot` ← **Bot Settings** ← **Menu Button**
3. أرسل: `https://postora-abc123.vercel.app`

## 5.6 اختبر داخل تلجرام

افتح `@Postora_1bot` ← اضغط **زر القائمة** (أسفل يسار)

**المتوقع:** يفتح Postora **داخل تلجرام** مع لوحة التحكم ببياناتك.

> 📘 التفاصيل: `docs/DEPLOY-VERCEL.md`

## 5.7 بديل: Docker

```bash
cp .env.example .env    # املأ القيم + POSTGRES_USER/PASSWORD/DB
docker compose up -d --build
docker compose exec backend node scripts/migrate.js up
docker compose logs -f backend
```

---

# الجزء 6: قائمة "ما يجب أن تعمله وتضيفه" كاملة

## 6.1 ما **يجب أن تعمله** (لا يمكن لأحد غيرك فعله)

| # | المهمة | إلزامي؟ | الوقت |
|---|---|---|---|
| 1 | إنشاء/الحصول على `BOT_TOKEN` من BotFather | ✅ **إلزامي** | 2 د |
| 2 | توليد `JWT_SECRET` عشوائي | ✅ **إلزامي** | 10 ث |
| 3 | تثبيت PostgreSQL وإنشاء المستخدم والقواعد | ✅ **إلزامي** | 10 د |
| 4 | إضافة البوت مسؤولًا في قناتك + **Post Messages** | للنشر | 2 د |
| 5 | رفع المشروع إلى GitHub | للنشر | 5 د |
| 6 | إنشاء حساب Render وربط المستودع | للنشر | 5 د |
| 7 | نشر Vercel (`npx vercel --prod`) | للـ Mini App | 3 د |
| 8 | ضبط **Menu Button** في BotFather | للـ Mini App | 1 د |
| 9 | إبطال التوكن القديم إن كان قد كُشف | 🔴 **عاجل** | 1 د |

## 6.2 ما **تضيفه** إلى `.env` (الحد الأدنى)

```env
BOT_TOKEN=...
DATABASE_URL=...
JWT_SECRET=...
```

## 6.3 ما **تضيفه** إلى `.env` للإنتاج

```env
NODE_ENV=production
BOT_MODE=webhook
WEBHOOK_URL=https://your-domain/telegram/webhook
WEBHOOK_SECRET=سلسلة-عشوائية
CORS_ORIGINS=https://your-vercel-app.vercel.app
MINIAPP_URL=https://your-vercel-app.vercel.app
```

## 6.4 ما **تضيفه** في تلجرام (BotFather)

| الإعداد | الأمر | الفائدة |
|---|---|---|
| قائمة الأوامر | `/setcommands` | قائمة جاهزة عند الكتابة |
| زر القائمة | `/setmenubutton` أو Bot Settings → Menu Button | **يفتح Mini App** |
| الوصف | `/setdescription` | نص شاشة "ماذا يمكن لهذا البوت" |
| النبذة | `/setabouttext` | نص الملف الشخصي |
| الصورة | `/setuserpic` | مظهر احترافي |

**قائمة الأوامر (انسخها كما هي):**

```
start - رسالة الترحيب
help - قائمة الأوامر
channels - قنواتك المرتبطة
status - حالة آخر نشر
cancel - إلغاء العملية الحالية
language - تبديل اللغة
```

## 6.5 ما **لا تضعه أبدًا** ❌

| ❌ لا تضعه | في |
|---|---|
| التوكن | أي ملف غير `.env` |
| التوكن | الواجهة / React / المتصفح |
| التوكن | Vercel Environment Variables |
| التوكن | GitHub / Git |
| التوكن | المحادثات |
| `TELEGRAM_API_BASE_URL` | الإنتاج (يوقف البوت صامتًا) |
| كلمات السر | `render.yaml` (استخدم `sync: false`) |

## 6.6 ما **يزيله/يبطله** بعد الاستخدام

| # | المهمة | متى |
|---|---|---|
| 1 | **إبطال التوكن** إن شُك في كشفه | فورًا |
| 2 | حذف رسائل الاختبار من القناة | بعد الاختبار |
| 3 | حذف `/tmp/pstoken` أو أي ملف مؤقت للتوكن | بعد الاختبار |

---

# الجزء 7: التحقق النهائي

بعد أي إعداد، شغّل:

```bash
npm run verify
```

**المتوقع:** `✅ 11 ناجح · ❌ 0 فاشل`

يفحص: Node · npm · `.env` · قاعدة البيانات · التبعيات · الترحيلات · **155 اختبارًا** · ESLint · البناء · إقلاع الخادم و`/health`.

## 7.1 قائمة تحقق محلية

- [ ] `node -v` → v20+
- [ ] `psql --version` → 15+
- [ ] `.env` موجود ويحتوي 3 قيم صحيحة
- [ ] `npm install` نجح
- [ ] `npm run migrate` → `Migrations complete!`
- [ ] `npm run dev` → `bot started (polling)`
- [ ] `curl localhost:3000/health` → `{"ok":true,"db":"up"}`
- [ ] `/start` في تلجرام يعمل
- [ ] `/channels` يعمل
- [ ] رفع ملف `.md` → معاينة + أزرار
- [ ] تأكيد → المنشور ظهر في القناة
- [ ] `npm test` → 155/155

## 7.2 قائمة تحقق النشر

- [ ] `curl https://postora-api.onrender.com/health` → `ok:true`
- [ ] `getWebhookInfo` → `url` صحيح و`last_error_message: null`
- [ ] Vercel: `curl https://your-app.vercel.app/health` → `ok:true`
- [ ] `curl -X POST .../api/auth/session` → **400** (لا 404)
- [ ] Menu Button في BotFather يشير إلى Vercel
- [ ] التطبيق يفتح داخل تلجرام ويعرض لوحة التحكم
- [ ] النشر من داخل تلجرام يعمل

---

# الجزء 8: استكشاف الأخطاء

| العَرَض | السبب | الحل |
|---|---|---|
| `إعدادات البيئة غير صالحة` | متغير ناقص في `.env` | الرسالة تذكر اسم الحقل — أضفه |
| `JWT_SECRET must be at least 32 characters` | السر قصير | ولّد جديدًا بالأمر أعلاه |
| `database is not reachable` | PostgreSQL متوقف أو `DATABASE_URL` خاطئ | `sudo service postgresql start` · تحقق من المنفذ 5432 |
| `relation "users" does not exist` | الترحيلات لم تُنفَّذ | `npm run migrate` |
| `EADDRINUSE :3000` | منفذ مشغول | `PORT=3001 npm run dev` أو أغلق العملية |
| الواجهة: «افتح من تلجرام» | **طبيعي في المتصفح** | افتحها من تلجرام، أو استخدم `ui-smoke-test.js` |
| **البوت لا يرد ولا يوجد خطأ** | ⚠️ `TELEGRAM_API_BASE_URL` موجّه لخادم وهمي | اجعله معلّقًا `#` في `.env` |
| `BOT DISABLED` في السجل | `BOT_TOKEN` قيمة المثال | ضع توكنًا حقيقيًا |
| `BOT TOKEN REJECTED (401)` | توكن خاطئ/مُبطَل | توكن جديد من BotFather |
| `BOT CONFLICT (409)` | نسختان تعملان بنفس التوكن | أوقف الأخرى |
| `CHANNEL_BOT_NOT_ADMIN` | البوت ليس مسؤولًا | أضفه Administrators |
| `CHANNEL_BOT_CANNOT_POST` | صلاحية النشر غير مفعّلة | فعّل **Post Messages** |
| `CHANNEL_ACCESS_DENIED` | أُزلت من إدارة القناة | أعد إضافتك/تحقق من الصلاحية |
| `PUBLICATION_DUPLICATE_WARNING` | نفس المحتوى خلال 10 دقائق | اضغط «نشر على أي حال» |
| Vercel: `No Output Directory named "dist"` | Root Directory خاطئ | اجعله `apps/miniapp` |
| Vercel: `Cannot find module '@postora/markdown-engine'` | البناء من مجلد فرعي | استخدم أوامر `vercel.json` |
| Vercel: `/api` يرجع 404 | النطاق في `vercel.json` لم يُحدَّث | `node scripts/deploy-vercel.mjs <نطاقك>` |
| Render: `relation does not exist` | `startCommand` بلا `migrate` | تحقق من `render.yaml` |
| Render: البوت يرد متأخرًا 30ث | الخدمة المجانية نائمة | طبيعي · استخدم webhook |

## 8.1 قراءة السجلات

```bash
# محليًا: مخرجات npm run dev
# ابحث عن: "level":50   ← أخطاء
#          "level":30   ← معلومات
```

```bash
# Render: Dashboard → postora-api → Logs
# Vercel: Dashboard → Deployments → Functions / Build Logs
```

## 8.2 فحص سريع شامل

```bash
curl -s localhost:3000/health | python3 -m json.tool
psql -U postora -h 127.0.0.1 -d postora_dev -c "SELECT count(*) FROM users;"
curl -s "https://api.telegram.org/bot<TOKEN>/getWebhookInfo" | python3 -m json.tool
```

---

## 📚 ملفات مرجعية أخرى

| الملف | المحتوى |
|---|---|
| `README.md` | نظرة عامة + ميزات |
| `EXTERNAL_SETUP.md` | الإعدادات الخارجية بالتفصيل |
| `docs/DEPLOY-RENDER.md` | نشر الخادم |
| `docs/DEPLOY-VERCEL.md` | نشر الواجهة |
| `docs/DEPLOYMENT.md` | Docker + Caddy + نسخ احتياطي |
| `docs/SECURITY.md` | نموذج التهديد |
| `docs/architecture.md` | المعمارية الكاملة |
| `docs/REAL-TELEGRAM-RESULTS.md` | نتائج الاختبار الحقيقي |
| `TEST_RESULTS.md` | كل أرقام الاختبارات |
