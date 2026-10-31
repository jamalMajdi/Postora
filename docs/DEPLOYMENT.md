# دليل النشر (Deployment)

> Covers: Docker Compose, HTTPS, Webhook mode, Mini App hosting, database backups.

## 1. الطوبولوجيا الموصى بها

```
        الإنترنت
            │ HTTPS
    ┌───────▼────────┐
    │  Caddy / Nginx  │  ← شهادة TLS تلقائية
    └───┬────────┬────┘
        │        │
   app.your.tld  api.your.tld
        │        │
  ┌─────▼─────┐  │
  │  miniapp  │  │  (ملفات ثابتة)
  └───────────┘  │
            ┌────▼─────┐
            │ backend  │  (Express + Bot)
            └────┬─────┘
            ┌────▼─────┐
            │ postgres │
            └──────────┘
```

**لماذا نطاقان؟** الواجهة تحتاج نطاقًا ثابتًا في BotFather، والخادم يحتاج نطاقًا لـ webhook. يمكن استخدام نطاق واحد مع مسارات (`/` للواجهة و `/api` للخادم) عبر reverse proxy واحد — أبسط وأرخص.

## 2. النشر بـ Docker Compose

```bash
git clone <repo> postora && cd postora
cp .env.example .env
nano .env      # عبّئ BOT_TOKEN, JWT_SECRET, CORS_ORIGINS, MINIAPP_URL
```

أضف لقاعدة البيانات في `.env`:

```env
POSTGRES_USER=postora
POSTGRES_PASSWORD=<كلمة-سر-قوية>
POSTGRES_DB=postora
```

```bash
docker compose up -d --build
docker compose exec backend node scripts/migrate.js up
docker compose logs -f backend
curl http://localhost:3000/health
```

## 3. Caddy (TLS تلقائي)

`Caddyfile`:

```caddyfile
your-domain.com {
    handle /api/* {
        reverse_proxy localhost:3000
    }
    handle /health {
        reverse_proxy localhost:3000
    }
    handle {
        reverse_proxy localhost:8080
    }
}
```

```bash
sudo caddy run --config Caddyfile
```

Caddy يحصل على شهادة Let's Encrypt تلقائيًا — لا حاجة لإعداد TLS يدويًا.

## 4. تفعيل Webhook

```env
BOT_MODE=webhook
WEBHOOK_URL=https://your-domain.com/telegram/webhook
WEBHOOK_SECRET=<سلسلة-عشوائية-طويلة>
```

```bash
docker compose restart backend
curl "https://api.telegram.org/bot$BOT_TOKEN/getWebhookInfo"
```

**لماذا Webhook؟** أنظف من polling (بلا long-polling دائم)، وأسرع استجابة، ومناسب للخوادم التي تنام (serverless).

> الخادم يتحقق من `X-Telegram-Bot-Api-Secret-Token` في كل طلب ويرفضه إن لم يطابق.

## 5. ترحيلات قاعدة البيانات

```bash
# ترقية
docker compose exec backend node scripts/migrate.js up

# تراجع خطوة
docker compose exec backend node scripts/migrate.js down
```

**قبل أي ترحيل في الإنتاج:**

```bash
docker compose exec db pg_dump -U postora postora > backup-$(date +%F).sql
```

## 6. النسخ الاحتياطي

**يوميًا عبر cron:**

```bash
0 3 * * * docker compose -f /opt/postora/docker-compose.yml exec -T db \
  pg_dump -U postora postora | gzip > /backups/postora-$(date +\%F).sql.gz
```

**الاستعادة:**

```bash
gunzip -c /backups/postora-2026-10-30.sql.gz | \
  docker compose exec -T db psql -U postora -d postora
```

**احتفظ بـ 30 نسخة على الأقل**، واختبر الاستعادة مرة كل ربع سنة.

## 7. المراقبة

| ما تراقبه | كيف |
|---|---|
| حياة الخادم | `GET /health` كل دقيقة (UptimeRobot / Healthchecks.io) |
| أخطاء التطبيق | `docker compose logs backend \| grep '"level":50'` |
| فشل النشر | `SELECT * FROM publications WHERE status='failed' ORDER BY created_at DESC LIMIT 20;` |
| أثر النشر | `SELECT * FROM publish_logs WHERE level='error' ORDER BY id DESC LIMIT 20;` |
| اتصال البوت | `curl "https://api.telegram.org/bot$TOKEN/getWebhookInfo"` |

## 8. تحديث الإنتاج

```bash
cd /opt/postora
git pull
docker compose up -d --build
docker compose exec backend node scripts/migrate.js up
docker compose logs -f backend
curl http://localhost:3000/health
```

**نشر بلا توقف:** استخدم خدمتين خلف موازن حمل (`docker compose up -d --scale backend=2`) — يتطلب أن يكون `BOT_MODE=webhook` (polling لا يعمل مع أكثر من نسخة واحدة).

## 9. قيود مهمة عند التوسع

| القيد | الحل عند الحاجة |
|---|---|
| Rate limiting في الذاكرة | انقله إلى Redis أو جدول `rate_limit_hits` |
| حالة معاينة البوت في الذاكرة | استخدم Redis أو جدول مؤقت (فقط إن شغّلت أكثر من نسخة) |
| Polling لا يدعم نسختين | استخدم webhook |
| لا توجد طوابير | أضف BullMQ/Redis لعمليات نشر طويلة |

> **المسار الحالي كافٍ لـ:** بوت واحد، حتى آلاف المستخدمين، نشر متزامن — وهو نطاق Postora المتوقع.

## 10. استكشاف أعطال الإنتاج

| العَرَض | التشخيص | الحل |
|---|---|---|
| البوت لا يرد (webhook) | `getWebhookInfo` يظهر `last_error_message` | تحقق من HTTPS والشهادة، ثم أعد `setWebhook` |
| `403 CHANNEL_BOT_NOT_ADMIN` متكرر | البوت أُزيل من القناة | أعد إضافته أدمن |
| `429 TELEGRAM_RATE_LIMITED` | نشر كثيف | خفّض عدد الرسائل أو افصل القنوات |
| الواجهة تعمل والبوت لا | الـ backend متوقف | `docker compose ps` و`logs` |
| `database is not reachable` | DB لم تقلع | `docker compose ps db` + تحقق من `healthcheck` |
| Mini App أبيض | فشل تحميل `initData` | افتحه من زر داخل تلجرام لا من متصفح |
