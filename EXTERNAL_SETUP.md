# EXTERNAL_SETUP.md — الإعدادات التي يجب أن تنفّذها بنفسك

> كل ما في هذه الوثيقة **لا يمكنني تنفيذه** لأنه يحتاج حسابك أو جهازك أو أسرارك.
> **لا ترسل أي سرّ في المحادثة.** ضع القيم في ملف `.env` على جهازك فقط.

---

## 1) التوكن الجديد للبوت (إلزامي)

**الوقت المقدر:** 3 دقائق

1. افتح [@BotFather](https://t.me/BotFather) في تلجرام.
2. تحقق أن البوت موجود: أرسل `/mybots` ← اختر `@Postora_1bot`.
3. **إن أردت توكنًا جديدًا** (موصى به إن شككت في تسريب أي توكن سابق):
   - اختر البوت ← **API Token** ← **Revoke current token**.
   - انسخ التوكن الجديد فورًا (يظهر مرة واحدة).
4. ضعه في `.env` على جهازك:

```env
BOT_TOKEN=123456789:AAH...التوكن-الجديد-هنا
```

5. تحقق (اختياري لكن مفيد):

```bash
curl "https://api.telegram.org/bot<التوكن>/getMe"
```

المتوقع: `{"ok":true,"result":{"id":...,"is_bot":true,"username":"Postora_1bot",...}}`

> ⚠️ **لا تضع التوكن في أي ملف آخر غير `.env`** — الملف مُستثنى في `.gitignore`.

---

## 2) بيانات البوت الأساسية (إلزامي)

في `.env`:

```env
BOT_USERNAME=Postora_1bot
```

**اختياري — إعدادات تحسين في BotFather:**

| الإعداد | الأمر في BotFather | الفائدة |
|---|---|---|
| وصف البوت | `/setdescription` | يظهر في شاشة "ماذا يمكن لهذا البوت أن يفعل" |
| نبذة قصيرة | `/setabouttext` | تظهر في ملف البوت |
| صورة البوت | `/setuserpic` | مظهر احترافي |
| أوامر القائمة | `/setcommands` | قائمة أوامر جاهزة — انسخ ما يلي |

```
start - رسالة الترحيب
help - قائمة الأوامر
channels - قنواتك المرتبطة
status - حالة آخر نشر
cancel - إلغاء العملية الحالية
language - تبديل اللغة
```

---

## 3) قاعدة بيانات PostgreSQL (إلزامي)

### الخيار أ: محليًا على جهازك

1. ثبّت PostgreSQL 15+ (راجع README قسم Windows).
2. أنشئ دورًا وقواعد بيانات:

```sql
CREATE ROLE postora LOGIN PASSWORD 'كلمة-سر-قوية-هنا';
CREATE DATABASE postora_dev OWNER postora;
CREATE DATABASE postora_test OWNER postora;
```

3. في `.env`:

```env
DATABASE_URL=postgresql://postora:كلمة-سر-قوية-هنا@127.0.0.1:5432/postora_dev
TEST_DATABASE_URL=postgresql://postora:كلمة-سر-قوية-هنا@127.0.0.1:5432/postora_test
```

### الخيار ب: خدمة مستضافة (Neon / Supabase / Railway / Render)

1. أنشئ مشروع PostgreSQL.
2. انسخ **Connection String** (يبدأ بـ `postgresql://`).
3. ⚠️ إن كانت الخدمة تتطلب SSL، أضف `?sslmode=require` في نهاية الرابط:
   `postgresql://user:pass@host/db?sslmode=require`
4. **أنشئ قاعدة منفصلة للاختبارات** أو استخدم نفس القاعدة مؤقتًا (الاختبارات **تمسح** المخطط — لا تستخدم قاعدة الإنتاج للاختبار أبدًا).

---

## 4) سرّ JWT (إلزامي)

ولّد سلسلة عشوائية قوية:

```bash
# Linux/macOS
node -e "console.log(require('crypto').randomBytes(48).toString('base64url'))"

# Windows PowerShell
node -e "console.log(require('crypto').randomBytes(48).toString('base64url'))"
```

ضعها في `.env`:

```env
JWT_SECRET=الناتج-هنا
```

> إن كان طوله أقل من 32 محرفًا سيرفض الخادم الإقلاع (حماية مقصودة).

---

## 5) قناة تلجرام تجريبية (إلزامي لاختبار النشر الحقيقي)

**الوقت المقدر:** 5 دقائق

1. في تلجرام: **New Channel** ← اسم ← **Private** (أو Public).
2. **Administrators** ← **Add Administrator** ← ابحث عن `@Postora_1bot` ← أضفه.
3. **مهم:** فعّل صلاحية **"Post Messages"** (نشر الرسائل) — بدونها سيرفض Postora النشر برسالة واضحة.
4. افتح التطبيق ← تبويب **القنوات** ← **إضافة قناة** ← أدخل:
   - `@اسم_القناة` إن كانت عامة، أو
   - معرّفها الرقمي `-100...` إن كانت خاصة.

**كيف تعرف المعرّف الرقمي لقناة خاصة؟**
أعد توجيه أي رسالة من القناة إلى [@userinfobot](https://t.me/userinfobot) أو استخدم [@JsonDumpBot](https://t.me/JsonDumpBot) — سيظهر `forward_from_chat.id`.

---

## 6) نشر الـ Mini App على HTTPS (إلزامي لاستخدامه من تلجرام)

تلجرام يشترط **HTTPS بشهادة صالحة**. الخيارات:

| الخيار | التكلفة | الصعوبة | ملاحظات |
|---|---|---|---|
| **Vercel / Netlify** | مجاني | ⭐ سهل | مثالي للواجهة الثابتة. أضف `BACKEND_URL` كـ rewrite لـ `/api/*` |
| **Cloudflare Pages** | مجاني | ⭐ سهل | يدعم rewrites عبر `_redirects` |
| **Railway / Render / Fly.io** | مجاني محدود | ⭐⭐ متوسط | يشغّل الخادم والواجهة معًا |
| **VPS + Caddy** | مدفوع | ⭐⭐⭐ | HTTPS تلقائي بـ Caddy |
| **Docker Compose + Caddy** | مدفوع | ⭐⭐⭐ | الأكثر تحكمًا (انظر `docs/DEPLOYMENT.md`) |

> 📘 **دليل مفصّل خطوة بخطوة:** [`docs/DEPLOY-VERCEL.md`](docs/DEPLOY-VERCEL.md) — يشمل `vercel.json` الجاهز واستكشاف الأخطاء.

### خطوات Vercel (الأسهل للواجهة)

1. اضبط نطاق الخادم في `vercel.json` (سطر واحد):
   ```bash
   node scripts/deploy-vercel.mjs https://api.your-domain.com
   ```
2. انشر:
   ```bash
   cd apps/miniapp && npx vercel --prod
   ```
3. بعد الحصول على الرابط، ضعه في `.env`:
   ```env
   MINIAPP_URL=https://your-app.vercel.app
   CORS_ORIGINS=https://your-app.vercel.app
   ```
5. أعد تشغيل الخادم ليظهر زر "فتح Postora" في رسالة `/start`.

---

## 7) ربط Mini App بالبوت في BotFather (إلزامي)

**الوقت المقدر:** دقيقتان

1. افتح [@BotFather](https://t.me/BotFather).
2. `/mybots` ← `@Postora_1bot` ← **Bot Settings** ← **Menu Button**.
3. أرسل رابط الـ HTTPS: `https://your-app.vercel.app`
4. (اختياري) **Configure Mini App** ← نفس الرابط ← يفعّل الرابط المباشر `t.me/Postora_1bot/app`.

**للتحقق:** افتح البوت ← اضغط زر القائمة (أسفل يسار) ← يجب أن يفتح التطبيق داخليًا مع تحقق `initData` تلقائي.

> إن ظهر "افتح من تلجرام" داخل تلجرام، فهذا يعني أن `initData` لم تُرسل — تحقق أنك فتحت الرابط **من زر** داخل تلجرام لا من متصفح خارجي.

---

## 8) Webhook بدلًا من Polling للإنتاج (موصى به)

Polling يعمل، لكن Webhook أكفأ وأخف.

1. انشر الخادم على HTTPS عام (مثل `https://api.your-domain.com`).
2. في `.env`:
   ```env
   BOT_MODE=webhook
   WEBHOOK_URL=https://api.your-domain.com/telegram/webhook
   WEBHOOK_SECRET=سلسلة-عشوائية-طويلة
   ```
3. أعد تشغيل الخادم — سيسجّل الـ webhook تلقائيًا عند الإقلاع.
4. تحقق:
   ```bash
   curl "https://api.telegram.org/bot<TOKEN>/getWebhookInfo"
   ```
   المتوقع: `"url":"https://api.your-domain.com/telegram/webhook"` وبلا `last_error_message`.

> الخادم يرفض أي طلب webhook لا يحمل `X-Telegram-Bot-Api-Secret-Token` الصحيح.

---

## 9) النشر عبر Docker Compose (اختياري لكن موصى به للإنتاج)

```bash
cp .env.example .env
# عبّئ القيم، وأضف:
#   POSTGRES_USER=postora
#   POSTGRES_PASSWORD=كلمة-سر-قوية
#   POSTGRES_DB=postora

docker compose up -d --build
docker compose exec backend node scripts/migrate.js up
docker compose logs -f backend
```

ثم ضع reverse proxy (Caddy/Nginx) بـ HTTPS أمام:
- المنفذ `3000` ← API
- المنفذ `8080` ← الواجهة

التفاصيل: `docs/DEPLOYMENT.md`.

---

## 10) قائمة تحقق نهائية قبل الإنتاج

- [ ] `BOT_TOKEN` جديد من BotFather (لم يُشارك مع أحد)
- [ ] `JWT_SECRET` عشوائي ≥ 32 محرفًا
- [ ] `DATABASE_URL` لقاعدة إنتاج (ليست `postora_test`)
- [ ] `NODE_ENV=production`
- [ ] `CORS_ORIGINS` يحتوي نطاق الواجهة فقط
- [ ] `MINIAPP_URL` رابط HTTPS
- [ ] `BOT_MODE=webhook` + `WEBHOOK_URL` + `WEBHOOK_SECRET`
- [ ] الترحيلات منفّذة (`npm run migrate` أو `node scripts/migrate.js up`)
- [ ] `/health` يرجع `{"ok":true,"db":"up"}`
- [ ] البوت يرد على `/start` من حسابك
- [ ] قناة تجريبية مربوطة + نشر تجريبي ناجح
- [ ] Mini App يفتح من BotFather Menu Button ويعمل
- [ ] `.env` **غير** مرفوع إلى Git (`git status` لا يُظهره)
- [ ] نسخ احتياطي دوري لقاعدة البيانات مُعدّ

---

## 11) أين أضع كل قيمة؟

| القيمة | مكانها | لا تضعها في |
|---|---|---|
| Bot Token | `.env` فقط | الكود، الواجهة، Git، المحادثة |
| DATABASE_URL | `.env` فقط | الكود، Git |
| JWT_SECRET | `.env` فقط | الكود، Git |
| WEBHOOK_SECRET | `.env` فقط | الكود، Git |
| نطاق الواجهة | `.env` (`MINIAPP_URL`) | — |

**تحقق سريع أن أسرارك غير مرفوعة:**

```bash
git status --porcelain | grep -i "\.env" ; echo "exit=$?"
```

يجب أن يكون الناتج فارغًا. وإن أضفت `.env` بالخطأ سابقًا:

```bash
git rm --cached .env
git commit -m "remove accidentally committed .env"
# ثم أعد توليد المفاتيح (اعتبر التوكن مسرَّبًا)
```
