# Postora Design System

> مرجع موحّد للهوية البصرية في Postora Mini App. أي إضافة جديدة تستهلك من هذه
> الرموز — لا قيم مكتوبة داخل المكوّنات.

## 1. المصادر

| الطبقة | الملف | المسؤولية |
|---|---|---|
| الرموز | `apps/miniapp/src/styles/tokens.css` | كل الألوان والمسافات والظلال والحركة والطباعة |
| الأساسيات | `apps/miniapp/src/styles/base.css` | إعادة تعيين + مكونات أولية (`.btn`, `.input`, `.card`, `.chip`, `.alert`) |
| الصفحات | `apps/miniapp/src/styles/app.css` | التخطيط والصفحات ومشهد المعاينة |
| الأيقونات | `apps/miniapp/src/components/ui/icons.jsx` | Lucide فقط، مُعاد تصديرها من مكان واحد |
| المكونات | `apps/miniapp/src/components/ui/` | `Sheet`, `Toast`, `EmptyState`, `SkeletonCard` |

## 2. الألوان

لون تمييز واحد (Indigo) + سلّم رمادي محايد + حالات دلالية.

| الرمز | فاتح | داكن | الاستخدام |
|---|---|---|---|
| `--ds-bg` | `#f7f8fb` | `#0b0f19` | خلفية الصفحة |
| `--ds-surface` | `#ffffff` | `#151c2b` | البطاقات والحقول |
| `--ds-surface-raised` | `#ffffff` | `#1b2334` | العناصر الطافية (Toast، Sheet) |
| `--ds-surface-sunken` | `#f2f4f9` | `#101725` | خلفية ثانوية داخلية |
| `--ds-text` | `#111827` | `#eef1f8` | النص الأساسي |
| `--ds-text-secondary` | `#5b6478` | `#a3adc2` | نص ثانوي |
| `--ds-text-tertiary` | `#8b93a7` | `#78829a` | نص مساعد |
| `--ds-border` | `#e6e9f0` | `#232c3e` | حدود |
| `--ds-accent` | `#4f46e5` | `#7c83ff` | التمييز والإجراءات الأساسية |
| `--ds-success` | `#12946b` | `#34d399` | نجاح |
| `--ds-warning` | `#b45309` | `#fbbf24` | تحذير |
| `--ds-danger` | `#dc2626` | `#f87171` | خطأ/حذف |

**قاعدة:** لا تكتب لونًا داخل مكوّن. استخدم `var(--ds-*)`.

## 3. الطباعة

| الرمز | الخط | الاستخدام |
|---|---|---|
| `--ds-font-sans` | Inter Variable → IBM Plex Sans Arabic | الواجهة العامة (لاتيني/أرقام) |
| `--ds-font-arabic` | IBM Plex Sans Arabic | كل الواجهة عند `dir="rtl"` |
| `--ds-font-mono` | JetBrains Mono → ui-monospace | المحرر، الكود، معرّفات القنوات |

الخطوط **مضمّنة ذاتيًا** عبر `@fontsource` — لا طلبات CDN، تعمل داخل تلجرام بلا إنترنت خارجي.

السلّم: `--ds-text-2xs` (10.5) … `--ds-text-3xl` (30). ارتفاع السطر للعربية أوسع
(`--ds-leading-relaxed`) لأن الحروف العربية تحتاج مساحة رأسية أكبر.

## 4. المسافات والأقطار والظلال

- مسافات على سلّم 4px: `--ds-space-1` … `--ds-space-12`.
- أنصاف أقطار: `xs 6` · `sm 10` · `md 14` · `lg 18` · `xl 24` · `full 999`.
- ظلال: `xs → xl` + `--ds-shadow-accent` للأزرار المتدرجة.
- حلقة تركيز: `--ds-ring` موحّدة لكل عنصر تفاعلي.

## 5. الحركة

| الرمز | القيمة | الاستخدام |
|---|---|---|
| `--ds-dur-fast` | 120ms | تحويم/ضغط |
| `--ds-dur-base` | 180ms | تبديل حالات |
| `--ds-dur-slow` | 280ms | دخول Sheet/Toast |
| `--ds-ease-out` | `cubic-bezier(.22,1,.36,1)` | الحركة الافتراضية |
| `--ds-ease-spring` | `cubic-bezier(.34,1.4,.64,1)` | دخول العناصر |

كل الحركات تُعطَّل تحت `prefers-reduced-motion: reduce`.

## 6. الأيقونات

**قاعدة صارمة: لا Emoji في الواجهة.** (اختبار آلي `designSystem.test.js` يفرض ذلك).
الإيموجي مسموح فقط داخل محتوى المستخدم المعروض كما هو.

```jsx
import { Icon, Trash2 } from '../ui/icons.jsx';

<Icon icon={Trash2} size={16} strokeWidth={2.2} />
```

- المصدر: `lucide-react` — مُستوردة بالأسماء فقط (tree-shaken).
- الأحجام المعتمدة: 12 (شارات) · 14–16 (أزرار) · 18–20 (تنقل) · 26 (حالات فارغة).
- سماكة الخط: 2.2 افتراضيًا، 1.9 للتنقل غير النشط، 2.3–2.5 للتأكيد.

## 7. المكونات

### الأزرار
`.btn--primary` · `--secondary` · `--ghost` · `--soft` · `--danger` · `--danger-solid`
الأحجام: `.btn--sm` · الافتراضي · `.btn--lg` · `.btn--icon` · `.btn--block`
الحد الأدنى للمس: **44px** (`--ds-tap-min`).

### الحقول
`.field` + `.field__label` + `.input` / `.select` / `.textarea` + `.field__hint`

### البطاقات
`.card` · `.card--flush` · `.card--raised` · `.stat-card` · `.channel-card`

### الشارات
`.badge--{published,failed,deleted,pending,publishing,cancelled}` — كلها بنقطة لونية.

### الحالات
`EmptyState` (أيقونة + عنوان + وصف + إجراء) و`SkeletonCard` للتحميل.
لا نستخدم نص "جارٍ التحميل" وحده في القوائم.

### التنبيهات
`.alert--{info,success,error,warning}` + `Toast` عابر مع شريط تقدّم وزر إغلاق.

### الورقة السفلية
`Sheet` — سحب للأسفل للإغلاق، حبس تركيز، Escape، إعادة تركيز.

## 8. الاستجابة

| العرض | التخطيط |
|---|---|
| ≤ 360px | عمود واحد، مسافات مضغوطة، شريط أدوات ملتف |
| 361–899px | عمود واحد، تنقل سفلي ثابت |
| ≥ 900px | تنقل جانبي (rail) + محتوى موسّط + 4 بطاقات إحصاء بصفّ واحد |

## 9. RTL / LTR

- كل المسافات والحدود تستخدم خصائص منطقية: `margin-inline`, `padding-inline`,
  `border-inline-start`, `inset-inline-end`.
- `<html dir>` يُضبط من `AppContext` حسب اللغة.
- العناصر المختلطة (تاريخ + رقم + وحدة) تُعزل بـ `unicode-bidi: isolate` لمنع انعكاسها.
- كتل الكود والروابط والمعرّفات تبقى `direction: ltr` دائمًا.

## 10. الوضع الداكن

- يُفعّل عبر `data-theme="dark"` على `<html>`، مصدره `themeParams` من تلجرام أولًا
  ثم `prefers-color-scheme`.
- نفس أسماء الرموز، قيم مختلفة — لا تجاوزات موضعية في المكونات.
- `color-scheme` مضبوط ليعمل مع عناصر النظام الأصلية.

## 11. الاختبار

```bash
npm run test:miniapp    # 107 اختبارًا: معاينة + Design System
```

`designSystem.test.js` يتحقق من:
- وجود كل الرموز المطلوبة + الوضع الداكن + تقليل الحركة.
- عدم وجود ألوان hex في `base.css` (كلها من الرموز).
- عدم وجود Emoji في أي صفحة أو مكوّن.
- تكافؤ مفاتيح الترجمة بين `ar` و`en` (١٠٠٪).
- بقاء مفاتيح اختبار الواجهة (`editor-textarea`, `stats-bar`, `data-route`…).
