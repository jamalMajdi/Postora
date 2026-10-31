# Postora — الوثيقة المعمارية (Architecture)

> **الإصدار:** v1.2 — النسخة النهائية المطابقة للتنفيذ (Phases 2–10 منفّذة ومختبَرة).
> **الحالة:** موثقة داخل المشروع؛ تطابق الكود الفعلي في `apps/` و`packages/`.
> **القاعدة:** هذه الوثيقة هي المرجع الأعلى للقرارات. أي تغيير جوهري يُسجَّل في سجل القرارات (القسم 12) مع تاريخه وسببه.

---

## 1. نظرة عامة

**Postora** نظام نشر احترافي على تلجرام بواجهتين أماميتين وقلب واحد:

| المكوّن | الوصف |
|---|---|
| **Markdown Engine** | حزمة JS نقية (بلا I/O) تُحوّل Markdown إلى **تمثيل وسيط موحّد (Segments)** ← رسائل تلجرام جاهزة للإرسال (نص + كيانات + HTML). المصدر الوحيد للحقيقة في التنسيق. |
| **Bot (`@Postora_1bot`)** | Telegraf: استقبال ملفات `.md`، تحقق، تحويل، **معاينة كرسائل تلجرام حقيقية** في الخاص، تأكيد/إلغاء، نشر. |
| **Mini App** | React + Vite + Telegram WebApp SDK: محرر Markdown، معاينة مباشرة، مسودات، إدارة قنوات، نشر. |
| **Backend** | Express + Telegraf + PostgreSQL. المصدر النهائي للتحويل والنشر والتحقق من الصلاحيات. |

### المبادئ المعمارية الثابتة

1. **فصل صارم:** handlers (Bot/HTTP) رقيقة ← Services (منطق العمل) ← Repositories (SQL). لا SQL ولا منطق عمل داخل أي handler.
2. **المحرك نقي ومستقل:** لا يعرف Telegraf ولا Express ولا DB؛ قابل للتشغيل في المتصفح والسيرفر بنفس النتيجة.
3. **Backend هو المصدر النهائي:** ما يُنشر في تلجرام هو ناتج المحرك في الخادم، وليس ما يدّعيه المتصفح.
4. **لا ثقة بالعميل:** كل هوية وصلاحية تُستخرج من `initData` الموثَّق أو من Telegram API، لا من جسم الطلب.
5. **الصلاحيات تُفحص حيًّا عند كل نشر** (لا اعتماد على المخزَّن).
6. **منع التكرار مرتبط بطلب النشر** (idempotency) لا بالمحتوى.
7. **لا تعقيد ولا جداول قبل الحاجة:** 6 جداول فقط.

---

## 2. القرارات المعتمدة

| # | القرار | الحالة |
|---|---|---|
| D1 | Monorepo باستخدام **npm workspaces** (`apps/server`, `apps/miniapp`, `packages/markdown-engine`, `packages/shared`) | ✅ معتمد |
| D2 | PostgreSQL + `pg` + **SQL مباشر Parameterized** + `node-pg-migrate` (مصدر الترحيلات = ملفات JS في المستودع) | ✅ معتمد |
| D3 | **تأجيل** جدول `rate_limit_hits`؛ Rate Limiting في الذاكرة (`express-rate-limit` + حَدّ داخلي في بوابة تلجرام) | ✅ معتمد |
| D4 | معاينة البوت = **رسائل تلجرام حقيقية** في المحادثة الخاصة (نفس ما سيُنشر) | ✅ معتمد |
| D5 | محرك Markdown **مشترك** بين الواجهة والخادم، والخادم هو المصدر النهائي للتحويل والنشر | ✅ معتمد |
| D6 | قياس حدود الرسائل بعد التحويل على **النص النهائي + الكيانات**، لا على Markdown الخام | ✅ معتمد (تفصيل §3) |
| D7 | منع التكرار = **مفتاح idempotency لكل طلب نشر** + السماح بإعادة النشر المتعمد | ✅ معتمد (تفصيل §4) |
| D8 | إعادة التحقق من صلاحية **البوت والمستخدم** في القناة عند **كل** عملية نشر | ✅ معتمد (تفصيل §4.2) |
| D9 | معاينة Mini App **مطابقة للمخرج النهائي** عبر نفس المحرك + محاكاة فقاعة تلجرام + تحقق اختياري من الخادم | ✅ معتمد (تفصيل §5) |
| D10 | `parse_mode = HTML` كهدف الإخراج (لا MarkdownV2) — هروب 3 محارف فقط | ✅ معتمد |
| D11 | لا أعمدة/جداول "للمستقبل": 6 جداول، ولا قيد فريد على `content_hash` | ✅ معتمد |

---

## 3. محرك Markdown — نموذج القياس والتحويل (D6)

### 3.1 المشكلة
`# عنوان` = 8 محارف خام لكنها تُعرض كـ **5** محارف (`عنوان`) داخل وسم عريض. وبالمقابل `**نص**` = 6 خام ← 3 معروضة. إذن عدد محارف Markdown **لا يمثل** حجم الرسالة. الحد الفعلي لتلجرام هو **4096 وحدة UTF-16** في **نص الرسالة الظاهر** (وليس في HTML المُرسل، وليس في Markdown المصدر).

### 3.2 خط الأنابيب (Pipeline)

```
markdown (نص خام، html:false)
  ① parse      → tokens (markdown-it)
  ② blockTree  → شجرة كتل مُبسَّطة (heading, paragraph, list, code, quote, hr, table)
  ③ segments   → مقاطع نصية نهائية + كيانات (bold/italic/strike/code/link/spoiler/underline)
  ④ layout     → تقسيم إلى رسائل ≤ 4096 على النص النهائي مع إعادة إغلاق التنسيق
  ⑤ serialize  → لكل رسالة: { text, entities[], html, plainLength }
  ⑥ measure    → chars = sum(text.length) بوحدات UTF-16، وentities_count
```

**التمثيل الوسيط (Segments)** هو العقد بين المراحل:

```js
// وصف مفاهيمي (ليس كودًا)
chunk = {
  text: "عنوان",                          // النص الظاهر فقط (ما يُرسل إلى تلجرام)
  entities: [{ type: "bold", offset: 0, length: 5 }],
  html: "<b>عنوان</b>",                   // مشتق من text + entities
  plainLength: 5                           // = text.length (UTF-16)
}
```

### 3.3 قواعد القياس (مطبقة في `measure.js` + تأكيد في `splitter.js`)
1. القياس على `text` النهائي بعد إزالة كل محارف Markdown، **بعد** تحويل الفواصل والمسافات البادئة للقوائم.
2. الوحدة = **UTF-16 code unit** (سلوك تلجرام): `"😀".length === 2` في JS — مطابقة مقصودة. **يُمنع** القص في منتصف surrogate pair.
3. فواصل الأسطر `\n` تُحسب محرفًا واحدًا (وهي كذلك في تلجرام).
4. المسافات البادئة للقوائم وإشارات `•` / `1.` تُحسب (لأنها تُرسل فعلًا).
5. القياس يشمل كل الرسائل مجتمعة (`totalChars`) وتُعرض في المعاينة: «سيُنشر في 3 رسائل — 8,420 حرفًا».
6. لا يوجد أي «قص صامت»: إذا لم يمكن التقسيم الآمن، تُعاد نتيجة `needsReview` لعرضها للمستخدم بدلًا من الإرسال الناقص.

### 3.4 استراتيجية التقسيم (لا حذف، لا اختصار)
1. **الحد المفضل للتقسيم أقل من 4096** (هامش أمان = 1024 محرف) لتقليل خطر الرفض.
2. التقسيم على **حدود الكتل** أولًا (paragraph / heading / list-item / quote / code-block).
3. كتلة واحدة > الحد:
   - كتلة كود: تقسيم على حدود الأسطر مع إعادة فتح `<pre>` في كل جزء وإضافة مؤشر `(تابع)` للسياق.
   - نص عادي: تقسيم على حدود الجُمل/المسافات مع **إعادة فتح الوسوم** في بداية الجزء التالي وإغلاقها في نهاية الجزء الحالي (حتى لا يظهر `<b>` مفتوحًا).
4. **الكيانات تُعاد حساب إزاحتها** (offset) لكل رسالة على حدة بعد التقسيم — وهذا جوهر سلامة التنسيق.
5. تحقق نهائي قبل الإرسال: كل رسالة `text.length ≤ 4096` وكل `entity.offset + entity.length ≤ text.length` → وإلا يُفشل التحويل ويُبلَّغ المستخدم.

### 3.5 خريطة التحويل (Markdown → Telegram) — ملخص
| Markdown | تلجرام | التنفيذ |
|---|---|---|
| `#..######` | لا يوجد عنوان | سطر عريض مستقل + سطر فارغ |
| `**bold**` / `__bold__` | `<b>` | segment bold |
| `*italic*` / `_italic_` | `<i>` | segment italic |
| `~~strike~~` | `<s>` | segment strike |
| `` `code` `` | `<code>` | segment code (بلا تحويل داخلي) |
| ```` ```lang ```` | `<pre><code class="language-x">` | بلوك محفوظ as-is |
| `[text](url)` | `<a href>` | رابط + تحقق من المخطط (http/https/tg فقط) |
| `> quote` | `<blockquote>` | blockquote |
| `- item` / `1. item` | لا يوجد | `• ` / `1. ` + مسافات بادئة |
| `- nested` | لا يوجد | `  • ` متزايدة |
| `---` | لا يوجد | سطر `──────────` |
| جدول | لا يوجد | كتلة `<pre>` محاذاة + تحذير في المعاينة |
| `![alt](url)` | لا يوجد داخل النص | رابط نصي `🖼 alt` + تحذير |
| HTML خام | مرفوض | `html:false` — يظهر كنص مهروب |
| `||spoiler||` (اختياري) | `<tg-spoiler>` | داعم للتمدد لاحقًا |

### 3.6 العربية وRTL
- `markdown-it` يعمل على Unicode بلا مشكلة؛ سنختبر نصوصًا عربية مشكَّلة، أرقامًا هندية، علامات ترقيم RTL، ورموزًا خاصة (`& < > " ' \` * _ [ ]`).
- التنسيقات المتداخلة العربية (`**عريض *مائل* عريض**`) تُختبر على مستوى الكيانات (offset/length).
- **تنبيه موثّق:** تلجرام لا يوفّر خصائص اتجاه (bidi) للرسائل العادية؛ محرك العرض/المتصفح يتولى الاتجاه. سنضبط `dir="auto"` في المعاينة و`dir="rtl"` للواجهة العربية، ولا نحاول "إجبار" الاتجاه داخل النص حتى لا نفسد روابط/أكواد.
- السطور المختلطة (عربي + بريد/رابط/كود) تُختبر بعينات مخصصة (fixtures) لأنها أكثر حالات الاتجاه هشاشة.

---

## 4. النشر والصلاحيات والتكرار (D7, D8)

### 4.1 Idempotency مرتبط بطلب النشر
- كل **نية نشر** (فتح شاشة التأكيد في البوت، أو الضغط على "نشر" في الميني آب) تُنشئ صفًا في `publications` بحالة `pending` و`idempotency_key` **فريد**.
- نفس المفتاح يُعاد استخدامه في أي إعادة محاولة شبكة/ضغط مزدوج ⇒ لا منشور ثانٍ (`UNIQUE (idempotency_key)`).
- الانتقال إلى `publishing` يتم **ذرّيًا**:
  `UPDATE publications SET status='publishing' WHERE id=$1 AND status='pending' RETURNING *` — إن أعاد 0 صفوف فالطلب قيد التنفيذ/انتهى ولا يُنشر مرة أخرى.
- الكيانات المخزّنة التي تُخزَّن بعد النشر (`telegram_message_ids`) تمنح إمكانية تتبّع/حذف لاحقًا.

### 4.2 إعادة النشر المتعمد مسموحة
- **لا قيد فريد على `content_hash`.** إعادة نشر نفس المحتوى مسموحة بطلب جديد ومفتاح جديد.
- لتقليل الخطأ البشري (وليس منعه): عند كشف نفس `(user, channel, content_hash)` في آخر 10 دقائق بحالة منشورة، يعرض البوت/التطبيق **تحذيرًا صريحًا** يتطلب تأكيدًا إضافيًا (`allow_duplicate = true`)، ثم يُنشر. هذا حماية من السهو لا قيد دائم.

### 4.3 التحقق الحي إلزامي
قبل كل نشر، بالترتيب (وأي فشل ⇒ `failed` مع رسالة عربية واضحة):
1. `getChat` — القناة موجودة؟
2. `getChatMember(bot)` — البوت أدمن ويملك `can_post_messages`؟
3. `getChatMember(user)` — المستخدم **مالك أو أدمن** في القناة الآن؟
4. تحديث `channels.bot_is_admin/bot_can_post/permissions_checked_at` كنتيجة فحص (كاش للعرض فقط، لا يُستخدم قرارًا أبدًا).
5. `sendMessage` للرسائل تباعًا مع تعليق عند الفشل: إن نجحت رسالة وفشلت التالية ⇒ حالة `failed` + تسجيل `telegram_message_ids` الناجحة + رسالة للمستخدم تشرح أن جزءًا نُشر وأن الجزء المتبقي لم يُنشر (لا إعادة تلقائية صامتة).
6. `429` ⇒ احترام `retry_after` مع backoff محدود، ثم فشل معلن.

---

## 5. تطابق معاينة Mini App (D9)

ثلاث طبقات تضمن التطابق:
1. **نفس المحرك حرفيًا:** حزمة `packages/markdown-engine` مستوردة في الواجهة والخادم — لا نسخة ثانية ولا منطق مكرر.
2. **نفس التمثيل:** الواجهة ترسم من `chunk.text + chunk.entities` (وليس من HTML strings)، داخل فقاعة تحاكي تلجرام (خط، هوامش، عرض أقصى، خلفية، فقاعات متعددة) — وهذا يمنع فروق "النص نفسه لكن الشكل مختلف".
3. **تحقق اختياري من الخادم:** زر/طلب `POST /api/preview` يُرجع المخرجات المعتمدة من الخادم (عدد الرسائل، أطوالها، الكيانات)؛ تقارن الواجهة بصمتها (hash) وتُظهر تحذيرًا إن اختلفت (يكشف أي انحراف إصدارات). كما تُظهر المعاينة تحذيرات التنسيقات غير المدعومة (جداول/صور) قبل النشر.

**الشفافية:** التطابق «قدر الإمكان» — تلجرام قد يختلف في تفاصيل الخط/العرض بحسب الجهاز، لكن **النص والتنسيق والتقسيم** متطابقة لأنها من نفس المصدر.

---

## 6. تصميم قاعدة البيانات (6 جداول)

### 6.1 الجداول
1. **`users`** — هوية موحدة بين البوت والميني آب: `id UUID PK`, `telegram_user_id BIGINT UNIQUE NOT NULL`, `username`, `first_name`, `last_name`, `language_code`, `preferred_locale ('ar'|'en')`, `is_blocked`, `created_at`, `updated_at`.
2. **`channels`** — القناة مخزنة مرة واحدة لكي تُشارك إدارتها: `id UUID PK`, `telegram_chat_id BIGINT UNIQUE NOT NULL`, `title`, `username`, `chat_type ('channel'|'supergroup')`, `bot_is_admin`, `bot_can_post`, `permissions_checked_at`, `created_by_user_id FK`, `is_active`, timestamps.
3. **`channel_members`** — من يملك حق الوصول: PK(`channel_id`,`user_id`), `role ('owner'|'admin'|'editor')`, `verified_at`. (فهرس على `user_id`.)
4. **`drafts`** — المحتوى القابل للتعديل: `id`, `user_id FK`, `title`, `content_markdown`, `content_hash`, `target_channel_id FK SET NULL`, `status ('draft'|'archived')`, `source ('bot'|'miniapp')`, `version INT` (قفل تفاؤلي), timestamps. فهارس: `(user_id, updated_at DESC)`, `(user_id, status)`.
5. **`publications`** — سجل كل **طلب نشر** ونتيجته: `id`, `user_id`, `draft_id SET NULL`, `channel_id RESTRICT`, `source`, `status ('pending'|'publishing'|'published'|'failed'|'cancelled')`, `idempotency_key TEXT UNIQUE NOT NULL`, `content_hash`, `rendered_messages_count`, `rendered_chars`, `telegram_chat_id`, `telegram_message_ids BIGINT[]`, `error_code`, `error_message`, `confirmed_at`, `published_at`, timestamps.
   - `CHECK (status <> 'published' OR published_at IS NOT NULL)`
   - فهارس: `(channel_id, created_at DESC)`, `(user_id, created_at DESC)`, جزئي على `status IN ('pending','publishing')`.
6. **`publish_logs`** — أثر التشخيص لكل محاولة: `id BIGSERIAL`, `publication_id FK CASCADE`, `attempt_number`, `stage`, `level`, `error_code`, `details JSONB` (**بدون أسرار**), `duration_ms`, `created_at`.

### 6.2 العلاقات
```
users 1─N drafts            users 1─N publications
users N─M channels (channel_members)   channels 1─N publications
drafts 1─N publications     publications 1─N publish_logs
```

### 6.3 ملاحظات
- كل الأوقات `TIMESTAMPTZ`، كل الحالات `CHECK`، كل FK بـ`ON DELETE` صريح.
- **لا قيد فريد على `content_hash`** (D7).
- لا جدول rate limiting (D3)، ولا جدول sessions (JWT بلا حالة حتى الحاجة).
- محتوى المسودة يُخزَّن **Markdown خامًا**، ولا يُخزَّن HTML.

---

## 7. طبقة API (العقد النهائي المنفَّذ)

| المسار | الطريقة | الغرض | الحماية |
|---|---|---|---|
| `/health` | GET | فحص حياة | عام |
| `/api/auth/session` | POST | تحقق `initData` ← JWT قصير | initData |
| `/api/me` | GET | بيانات المستخدم + إحصاءات | JWT |
| `/api/drafts` | GET/POST | قائمة/إنشاء | JWT |
| `/api/drafts/:id` | GET/PATCH/DELETE | إدارة (مع `version`) | JWT + ملكية |
| `/api/channels` | GET/POST | قائمة/ربط قناة | JWT |
| `/api/channels/:id` | DELETE | فصل قناة (owner فقط) | JWT + ملكية |
| `/api/channels/:id/verify` | POST | إعادة فحص صلاحيات البوت | JWT + ملكية |
| `/api/preview` | POST | مخرجات المحرك المعتمدة (تطابق المعاينة) | JWT + rate limit |
| `/api/publications` | POST | إنشاء طلب نشر (idempotency + فحص حي) | JWT + ملكية + rate limit |
| `/api/publications/:id/confirm` | POST | تأكيد تجاوز تحذير التكرار ثم النشر | JWT + ملكية |
| `/api/publications/:id/cancel` | POST | إلغاء طلب معلّق | JWT + ملكية |
| `/api/publications` | GET | سجل النشر (مع ترقيم) | JWT |
| `/api/publications/:id` | GET | تفاصيل طلب نشر | JWT + ملكية |
| `/api/auth/me` | GET | تحقق سريع من صلاحية التوكن | JWT |
| `/api/me/locale` | PATCH | تبديل اللغة المفضلة | JWT |

**ملاحظة فصل:** مسار `/api/preview` و`/api/publications` يستدعيان نفس `markdown-engine` و`publishingService` المستخدمين في البوت — لا منطق مزدوج.

**شكل الاستجابة الموحّد:** `{ data, error }` — النجاح `{data: ...}`، الفشل `{error: {code, message, details}}` برمز HTTP مطابق.
**الحدود:** `authLimiter` 10/دقيقة، `previewLimiter` 30/دقيقة، `publishLimiter` 10/دقيقة (في الذاكرة — D3).

---

## 8. هيئة المشروع (الفعلي بعد التنفيذ)

الهيكل أدناه **مطابق للملفات الموجودة فعلًا** في المستودع (لا مخطط نظري):

```
postora/
├─ apps/
│  ├─ server/
│  │  ├─ src/
│  │  │  ├─ index.js                    بدء التشغيل: DB → migrate-check → bot → HTTP
│  │  │  ├─ app.js                      بناء Express (قابل للاختبار بلا شبكة)
│  │  │  ├─ container.js                تركيب الخدمات (DI صريح)
│  │  │  ├─ config/env.js               Zod على متغيرات البيئة + تحميل .env من جذر المشروع
│  │  │  ├─ api/
│  │  │  │  ├─ router.js                تجميع المسارات
│  │  │  │  ├─ middleware/{authenticate,errorHandler,rateLimit,validate}.js
│  │  │  │  └─ routes/{auth,me,channel,draft,publish}Routes.js
│  │  │  ├─ bot/
│  │  │  │  ├─ bot.js                   إنشاء Telegraf + webhook/polling
│  │  │  │  ├─ commands/{start,help,channels,misc}.js
│  │  │  │  ├─ flows/{previewFlow,publishFlow}.js
│  │  │  │  ├─ handlers/index.js        استقبال الملفات/النصوص/الأزرار
│  │  │  │  ├─ keyboards/common.js      لوحات الأزرار
│  │  │  │  ├─ middleware/{ensureUser,rateLimit,errorBoundary}.js
│  │  │  │  └─ texts.js                 كل نصوص المستخدم (ar/en)
│  │  │  ├─ services/{auth,channel,draft,publishing,render}Service.js
│  │  │  ├─ db/
│  │  │  │  ├─ pool.js                  pg Pool + graceful shutdown
│  │  │  │  ├─ repositories/{user,channel,draft,publication}Repository.js
│  │  │  │  └─ migrations/1700000000001_init.js
│  │  │  ├─ telegram/{gateway,errors,initDataValidator,publishing,rateLimiter}.js
│  │  │  ├─ files/markdownFile.js       تحقق الامتداد/الحجم/UTF-8
│  │  │  ├─ errors/AppError.js
│  │  │  └─ utils/{crypto,logger}.js
│  │  └─ tests/{unit,integration,helpers}/
│  └─ miniapp/
│     └─ src/
│        ├─ main.jsx, App.jsx
│        ├─ context/AppContext.jsx      الجلسة + القنوات + i18n + toasts
│        ├─ lib/{telegramSdk,apiClient,markdown}.js
│        ├─ i18n/{ar,en,index}.js
│        ├─ components/
│        │  ├─ layout/AppShell.jsx
│        │  ├─ editor/MarkdownEditor.jsx
│        │  ├─ preview/TelegramPreview.jsx
│        │  └─ ui/{Toast,Sheet,EmptyState}.jsx
│        ├─ pages/{Dashboard,Editor,Drafts,Channels}Page.jsx
│        └─ styles/{tokens,base,app}.css
├─ packages/
│  ├─ markdown-engine/src/{index,parse,segments,splitter,serialize,measure,escape,warnings,constants}.js
│  └─ shared/src/{index,errors,limits,schemas}.js
├─ docs/{architecture,deployment,security,features-and-limitations}.md
├─ scripts/{dev,migrate,fake-telegram-server,ui-smoke-test}.js, ensure-db.sh, verify.sh
└─ {README,TEST_RESULTS,EXTERNAL_SETUP}.md, .env.example, docker-compose.yml
```

### 8.1 تغييرات عن المخطط الأولي (مع السبب)

| البند | المخطط (v1.1) | المنفّذ (v1.2) | السبب |
|---|---|---|---|
| `telegram/publishing.js` | داخل `publishingService` | ملف مستقل | فصل نداءات Bot API الخام عن منطق العمل |
| `bot/texts.js` | لم يكن مخططًا | ملف مستقل | كل نصوص المستخدم في مكان واحد ⇒ i18n بلا تكرار |
| `packages/shared/src/limits.js` | داخل `constants` | حزمة مشتركة | الواجهة والخادم يحتاجان نفس الأرقام (4096/100/40) |
| `apps/*/Dockerfile` + `docker-compose.yml` | غير مخططة | مضافة | مطلب النشر في المرحلة 9 |
| `scripts/fake-telegram-server.js` | جزء من helpers الاختبار | خادم مستقل + helpers | إتاحة تجربة البوت كاملًا محليًا بلا توكن |
| `scripts/ui-smoke-test.js` | غير مخطط | مضاف | اختبار واجهة حقيقي (لا مجرد «البناء نجح») |
| مسار النشر | `POST /api/publish` | `POST /api/publications` | REST أوضح: المورد هو «منشور» لا «فعل نشر» |
| `POST /api/publications/:id/confirm` | `allowDuplicate` في نفس الطلب | مسار تأكيد صريح منفصل | يفصل «طلب النشر» عن «تأكيد التجاوز» ⇒ المفتاح يبقى نفسه |

## 9. قيود Telegram API المحورية
1. 4096 وحدة UTF-16 لكل رسالة (القياس على النص النهائي — §3).
2. `parse_mode` = HTML: وسوم مسموحة فقط (`b,i,u,s,a,code,pre,blockquote,tg-spoiler`)؛ لا `h1..h6,ul,ol,li,table,img,p,br`.
3. لا دعم للعناوين/القوائم/الجداول/الصور داخل النص ⇒ تحويل بصري + تحذير.
4. `getFile` ≤ 20MB (لذا حد الملف لدينا 256KB والمحتوى 100K محرف).
5. حدود المعدل: ~30 رسالة/ث، ~20/دقيقة لكل مجموعة/قناة، `429` + `retry_after` ⇒ backoff.
6. Webhook يحتاج HTTPS + `secret_token`؛ Polling للتطوير فقط.
7. Mini App: HTTPS إلزامي + `initData` موثّق (HMAC + `auth_date` حديث + رفض التوقيع غير الصالح).
8. أخطاء شائعة: `can't parse entities`, `bot is not a member`, `chat not found`, `bot was blocked`, `429`.

---

## 10. نموذج التهديد والضوابط (مختصر)
| الخطر | الضابط |
|---|---|
| تسريب Bot Token | `.env` + تحقق Zod عند الإقلاع + redaction في السجلات + لا endpoint للتوكن |
| انتحال هوية | تحقق `initData` على الخادم فقط + عمر `auth_date` + JWT قصير |
| IDOR / نشر غير مصرح | كل استعلام مقيّد بـ user + **فحص حي** `getChatMember` عند النشر |
| تكرار النشر | `idempotency_key UNIQUE` + انتقال حالة ذرّي + تحذير التكرار (D7) |
| HTML خبيث | `html:false` + allowlist للوسوم + هروب `& < >` + لا `innerHTML` غير موثوق |
| ملفات ضارة/ضخمة | تحقق امتداد+حجم+ترميز قبل وبعد التنزيل + حدود محتوى |
| DoS محتوى | حدود كتل/عمق/سطر + timeout + rate limit |
| حقن SQL | Parameterized فقط |
| replay / callback قديم | عمر الطلب + حالة في DB + رد «انتهت الصلاحية» |
| webhook مزيف | `secret_token` في كل طلب |
| تسريب في الأخطاء | `errorHandler` موحد + لا stack في الإنتاج + رموز خطأ |

---

## 11. خارطة الطريق — الحالة الفعلية

| المرحلة | المخرجات | بوابة القبول | الحالة |
|---|---|---|---|
| 1 | المعمارية | ✅ معتمدة | ✅ مكتملة |
| 2 | Monorepo + env + `/health` + DB | `/health` → `{ok:true,db:"up"}` | ✅ **تحقق فعليًا** |
| 3 | أساس البوت | على خادم تلجرام وهمي: ترحيب، ملف صحيح/خاطئ/كبير | ✅ `bot.test.js` 14/14 |
| 4 | محرك Markdown | ≥40 حالة | ✅ **50 اختبارًا** خضراء |
| 5 | معاينة + تأكيد + نشر + idempotency | E2E: نشر ناجح، ضغط مزدوج ⇒ منشور واحد، فشل صلاحية ⇒ خطأ عربي | ✅ `publish.test.js` 15/15 |
| 6 | Migrations + API + JWT + Zod + rate limit | Supertest 200/401/403/409 | ✅ 93 اختبار خادم |
| 7 | Mini App كامل | بناء ينجح + dev يعمل + اختبار من الواجهة | ✅ **9/9 خطوات في متصفح حقيقي** |
| 8 | أمان وتكرار وأخطاء | `TEST_RESULTS.md` | ✅ مكتوب بأرقام حقيقية |
| 9 | إنتاج (Docker, webhook, HTTPS docs) + README | تعليمات قابلة للتنفيذ | ✅ `DEPLOYMENT.md` + `docker-compose.yml` + Dockerfiles |
| 10 | ملفات التسليم | مراجعة المالك | ✅ `README`, `TEST_RESULTS`, `EXTERNAL_SETUP`, `docs/*` |

**نتيجة الاختبارات:** 155/155 (محرك 50 + مشترك 12 + خادم 93) + 9/9 خطوات واجهة.

---

## 12. سجل القرارات (Changelog)

| الإصدار | التاريخ | التغيير |
|---|---|---|
| v1.0 | 2026-10-30 | المسودة الأولى (معمارية، هيكلية، DB، مخاطر، خارطة طريق) |
| v1.1 | 2026-10-30 | اعتماد D1–D11: Monorepo، pg+SQL مباشر، تأجيل جدول rate limiting، معاينة حقيقية، محرك مشترك، **قياس بعد التحويل (§3)**، **Idempotency لكل طلب + إعادة نشر متعمد (§4)**، **فحص حي للصلاحيات (§4.3)**، **تطابق معاينة Mini App (§5)**، إلغاء قيد `content_hash` الفريد، نموذج Segments بدل HTML خام، توثيق قيود RTL، تحديث بوابة القبول لتشمل خادم تلجرام وهمي للاختبار بلا توكن |
| v1.2 | 2026-10-30 | **النسخة النهائية**: مطابقة للتنفيذ الفعلي — §8 يعرض الملفات الحقيقية وتغييرات المخطط مع أسبابها، §7 يعرض مسارات API الفعلية (`/api/publications` بدل `/api/publish`، وإضافة `confirm`/`cancel`)، §11 يعرض نتائج كل مرحلة الفعلية (155/155 + 9/9)، إضافة `docs/features-and-limitations.md`. تغييرات جوهرية: مسار تأكيد منفصل لتجاوز التكرار، فصل `telegram/publishing.js`، إضافة `bot/texts.js` و`packages/shared/src/limits.js`. |

---

## 13. حدود بيئة التنفيذ (Sandbox) — مؤثرة على المشروع
- التنفيذ داخل حاوية Linux (Debian 13), Node LTS, PostgreSQL 17 — يمكن تشغيل Backend/DB/الاختبارات فعليًا.
- **لا توجد بيانات اعتماد تلجرام حقيقية** ⇒ اختبار البوت يتم على **خادم تلجرام وهمي محلي** (نفس بروتوكول Bot API) عبر `TELEGRAM_API_BASE_URL`، مع بقاء الكود موجهًا لـ `api.telegram.org` افتراضيًا. الاختبار النهائي على تلجرام الحقيقي يكون من جهاز المالك.
- لا يمكن فتح Mini App داخل تلجرام فعليًا من الحاوية (لا WebView/initData حقيقية) ⇒ نستخدم تطويرًا محليًا بـ initData موقّع بمفتاح اختبار + خادم تطوير؛ الاختبار على الجهاز من المالك.
- لا نشر إنتاجي/نطاق/HTTPS من الحاوية ⇒ نُسلّم ملفات وإعدادات ووثائق النشر.
