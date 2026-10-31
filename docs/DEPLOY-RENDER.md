# نشر الخادم على Render

> **الهدف:** تشغيل Backend (Express + Telegraf + PostgreSQL) على نطاق HTTPS عام،
> ثم ربطه بواجهة Vercel وبالبوت.
>
> **الوقت المتوقع:** 10–15 دقيقة · **التكلفة:** مجاني (خطة Free).

---

## 0) لماذا Render؟

| السبب | التفصيل |
|---|---|
| HTTPS تلقائي | تلجرام يشترطه للـ webhook وللـ Mini App |
| PostgreSQL مُدار | يُربط تلقائيًا عبر `render.yaml` |
| دعم Webhook | لا يحتاج تشغيلًا دائمًا — الخدمة المجانية تنام |
| Blueprint | `render.yaml` في المستودع ينشئ كل شيء بأمر واحد |

> ⚠️ **الخدمة المجانية تنام بعد ~15 دقيقة خمول** وتستيقظ في ~30 ثانية.
> لذلك **`BOT_MODE=webhook` إلزامي**: مع `polling` يتوقف البوت عن استقبال التحديثات عند النوم.

**المخطط النهائي:**

```
تلجرام ──webhook──► postora-api.onrender.com   (الخادم + البوت)
                          │
                          ├─► PostgreSQL (postora-db)
                          │
تلجرام WebView ─► postora.vercel.app ──/api/*──┘
```

---

## 1) ارفع المشروع إلى Git

Render ينشر من مستودع (GitHub / GitLab / Bitbucket).

```bash
cd postora
git init
git add .
git commit -m "Postora initial commit"
git branch -M main
git remote add origin https://github.com/<user>/postora.git
git push -u origin main
```

> ✅ تأكد أن `.env` **غير** مرفوع: `git status --porcelain | grep .env` يجب أن يكون فارغًا.
> الملف موجود في `.gitignore` بالفعل.

---

## 2) أنشئ Blueprint

1. افتح <https://dashboard.render.com>
2. **New** ← **Blueprint**
3. اربط مستودع `postora`
4. Render يقرأ `render.yaml` ويعرض:
   - `postora-api` (Web Service)
   - `postora-db` (PostgreSQL)
5. اضغط **Apply**

سيطلب منك إدخال القيم السرّية (المعلّمة `sync: false`):

| المتغير | القيمة |
|---|---|
| `BOT_TOKEN` | التوكن من [@BotFather](https://t.me/BotFather) |
| `CORS_ORIGINS` | نطاق Vercel (مثال `https://postora.vercel.app`) — ضعه الآن أو لاحقًا |
| `MINIAPP_URL` | نفس النطاق |

**القيم التي يولّدها Render تلقائيًا:**

| المتغير | الطريقة |
|---|---|
| `DATABASE_URL` | من قاعدة `postora-db` |
| `JWT_SECRET` | `generateValue` — عشوائي قوي |
| `WEBHOOK_SECRET` | `generateValue` — عشوائي قوي |
| `WEBHOOK_URL` | **يُشتق تلقائيًا** من `RENDER_EXTERNAL_URL` داخل `config/env.js` |

> 🎯 **لماذا لا تحتاج ضبط `WEBHOOK_URL`؟** Render يوفّر `RENDER_EXTERNAL_URL`
> (`https://postora-api.onrender.com`) تلقائيًا، والخادم يبني منه رابط الـ webhook عند الإقلاع.
> تحقّقت من ذلك باختبار فعلي — راجع `TEST_RESULTS.md` §12.

---

## 3) انتظر أول نشر

Render ينفّذ تلقائيًا:

```bash
# buildCommand
npm ci --omit=dev --include=dev && npm run build

# startCommand
node scripts/migrate.js up && node apps/server/src/index.js
```

**الترحيلات تُنفَّذ تلقائيًا في كل إقلاع** — لا تحتاج تشغيلها يدويًا.

تابع السجلات: **Dashboard** ← `postora-api` ← **Logs**

المتوقع:

```json
{"level":30,"env":"production","botMode":"webhook","port":10000,"msg":"starting postora"}
{"level":30,"msg":"database connected"}
{"level":30,"port":10000,"msg":"http server listening"}
{"level":30,"mode":"webhook","msg":"bot webhook configured"}
{"level":30,"msg":"bot started"}
```

> `mode: "webhook"` + `bot started` ⇒ البوت مربوط بتلجرام بنجاح.
> إن رأيت `BOT TOKEN REJECTED (401)` فالتوكن خاطئ — صحّحه من **Environment** وأعد النشر.

---

## 4) تحقق من الخادم

```bash
curl https://postora-api.onrender.com/health
```

المتوقع:

```json
{"ok":true,"service":"postora","version":"1.0.0","db":"up","timestamp":"..."}
```

`"db":"up"` يعني أن الاتصال بقاعدة البيانات سليم.

**تحقق من الـ webhook:**

```bash
curl "https://api.telegram.org/bot<TOKEN>/getWebhookInfo"
```

المتوقع:

```json
{
  "url": "https://postora-api.onrender.com/telegram/webhook",
  "pending_update_count": 0,
  "last_error_message": null
}
```

> إن ظهر `last_error_message` فهناك مشكلة في الوصول للنطاق. تحقق أن الخدمة مستيقظة.

---

## 5) اربط الواجهة (Vercel)

على جهازك:

```bash
node scripts/deploy-vercel.mjs https://postora-api.onrender.com
cd apps/miniapp && npx vercel --prod
```

بعد الحصول على نطاق Vercel، أضفه في Render:

**Dashboard** ← `postora-api` ← **Environment** ← عدّل:

```env
CORS_ORIGINS = https://postora.vercel.app
MINIAPP_URL  = https://postora.vercel.app
```

← **Save Changes** (سيُعيد النشر تلقائيًا)

ثم في BotFather: **Bot Settings** ← **Menu Button** ← أرسل نطاق Vercel.

التفاصيل: [`DEPLOY-VERCEL.md`](DEPLOY-VERCEL.md)

---

## 6) استكشاف أخطاء Render

| العَرَض | السبب | الحل |
|---|---|---|
| `BOT TOKEN REJECTED (401)` في السجلات | `BOT_TOKEN` خاطئ/مُبطَل | صحّحه في Environment، أعد النشر |
| `database is not reachable` | `DATABASE_URL` غير مربوط | تحقق أن `postora-db` أُنشئت، وأعد Deploy |
| `relation "users" does not exist` | الترحيلات لم تُنفَّذ | تحقق أن `startCommand` يحتوي `migrate.js up` |
| `WEBHOOK_URL must be an https URL` | `BOT_MODE=webhook` بلا رابط | تأكد أن `RENDER_EXTERNAL_URL` موجود (Render يضيفه تلقائيًا) |
| البوت يرد ببطء أول رسالة (~30ث) | الخدمة كانت نائمة | طبيعي في الخطة المجانية؛ استخدم خطة مدفوعة للاستمرار |
| `502` من Vercel على `/api/*` | الخادم نائم أو يسقط | افتح `https://postora-api.onrender.com/health` لإيقاظه |
| الواجهة تعمل والبوت لا | polling مفعّل والنوم يقطعه | تأكد `BOT_MODE=webhook` |
| `CORS` error في المتصفح | `CORS_ORIGINS` لا يطابق نطاق Vercel | أضف النطاق بالضبط (بلا `/` في النهاية) |

### قراءة السجلات

```bash
# من لوحة Render: Dashboard → postora-api → Logs
```

ابحث عن `"level":50` (أخطاء) — وليس `"level":30` (معلومات).

---

## 7) التحديث والنشر التلقائي

`autoDeploy: true` في `render.yaml` ⇒ أي `git push` إلى `main` يعيد النشر.

```bash
git add .
git commit -m "update"
git push
```

**نشر يدوي:** Dashboard ← **Manual Deploy** ← **Deploy latest commit**.

---

## 8) ملاحظات أمنية

| البند | الحالة |
|---|---|
| `BOT_TOKEN` | `sync: false` — لا يُحفظ في المستودع |
| `JWT_SECRET` | `generateValue` — Render يولّده |
| `WEBHOOK_SECRET` | `generateValue` — Render يولّده |
| `DATABASE_URL` | مربوط داخليًا، لا يظهر في الكود |
| `TELEGRAM_API_BASE_URL` | **لا تضبطه** — يُوجّه البوت لخادم وهمي صامتًا |

**لا تضع أي سر في `render.yaml`** — استخدم `sync: false` أو `generateValue` فقط.

---

## 9) قائمة تحقق نهائية

- [ ] المشروع مرفوع على Git و`.env` غير مرفوع
- [ ] Blueprint طُبِّق وأنشأ `postora-api` + `postora-db`
- [ ] `BOT_TOKEN` و`CORS_ORIGINS` و`MINIAPP_URL` مضبوطة
- [ ] السجلات تُظهر `bot webhook configured` و`bot started`
- [ ] `curl .../health` → `{"ok":true,"db":"up"}`
- [ ] `getWebhookInfo` → `url` صحيح و`last_error_message: null`
- [ ] `/start` يعمل من حسابك على تلجرام
- [ ] Vercel يشير إلى نطاق Render
- [ ] التطبيق يفتح من تلجرام ويعرض لوحة التحكم

---

## 10) خطة مجانية أم مدفوعة؟

| | مجاني | مدفوعة (Starter) |
|---|---|---|
| نوم بعد خمول | نعم (~15 د) | لا |
| استيقاظ | ~30 ثانية | فوري |
| Webhook | ✅ يعمل | ✅ يعمل |
| Polling | ❌ ينقطع | ✅ يعمل |
| مناسب لـ | تجربة/استخدام شخصي | إنتاج جدّي |

> مع **webhook** لن تفقد أي تحديث حتى لو نامت الخدمة —
> تلجرام يحتفظ بها ويعيد إرسالها عند الاستيقاظ. أول رسالة فقط قد تتأخر.
