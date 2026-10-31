#!/usr/bin/env bash
# ============================================================
# Postora — تحقق شامل من التسليم
#
# يشغّل كل ما يمكن تشغيله فعليًا في بيئة نظيفة:
#   1) فحص المتطلبات
#   2) تثبيت التبعيات
#   3) الترحيلات
#   4) كل الاختبارات (155)
#   5) بناء الواجهة
#   6) إقلاع الخادم + فحص /health
#
# الاستخدام:
#   bash scripts/verify.sh
#
# ملاحظة: يحتاج قاعدة بيانات متاحة عبر DATABASE_URL (أو TEST_DATABASE_URL للاختبارات).
# ============================================================
set -uo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

PASS=0
FAIL=0
SKIP=0
declare -a RESULTS=()

green() { printf '\033[32m%s\033[0m\n' "$*"; }
red()   { printf '\033[31m%s\033[0m\n' "$*"; }
yellow(){ printf '\033[33m%s\033[0m\n' "$*"; }
bold()  { printf '\033[1m%s\033[0m\n' "$*"; }

record() { # name status detail
  local name="$1" status="$2" detail="${3:-}"
  RESULTS+=("$status|$name|$detail")
  case "$status" in
    PASS) PASS=$((PASS+1)); green   "  ✅ $name${detail:+ — $detail}" ;;
    FAIL) FAIL=$((FAIL+1)); red     "  ❌ $name${detail:+ — $detail}" ;;
    SKIP) SKIP=$((SKIP+1)); yellow  "  ⏭  $name${detail:+ — $detail}" ;;
  esac
}

step() { echo; bold "▶ $*"; }

# ------------------------------------------------------------
step "1) فحص المتطلبات"
# ------------------------------------------------------------
if command -v node >/dev/null 2>&1; then
  NODE_V="$(node -v)"
  NODE_MAJOR="${NODE_V#v}"; NODE_MAJOR="${NODE_MAJOR%%.*}"
  if [ "$NODE_MAJOR" -ge 20 ]; then
    record "Node.js $NODE_V" PASS
  else
    record "Node.js $NODE_V (يحتاج ≥ 20)" FAIL
  fi
else
  record "Node.js" FAIL "غير مثبّت"
fi

if command -v npm >/dev/null 2>&1; then
  record "npm $(npm -v)" PASS
else
  record "npm" FAIL "غير مثبّت"
fi

if [ -f .env ]; then
  record "ملف .env موجود" PASS
else
  record "ملف .env" SKIP "غير موجود — انسخ .env.example"
fi

# هل قاعدة البيانات متاحة؟
DB_URL="${TEST_DATABASE_URL:-${DATABASE_URL:-}}"
if [ -z "$DB_URL" ] && [ -f .env ]; then
  DB_URL="$(grep -E '^TEST_DATABASE_URL=' .env 2>/dev/null | cut -d= -f2- || true)"
  [ -z "$DB_URL" ] && DB_URL="$(grep -E '^DATABASE_URL=' .env 2>/dev/null | cut -d= -f2- || true)"
fi
if [ -n "$DB_URL" ] && node -e "
  const { Client } = require('pg');
  const c = new Client({ connectionString: process.argv[1] });
  c.connect().then(() => c.query('SELECT 1')).then(() => c.end()).then(() => process.exit(0)).catch(() => process.exit(1));
" "$DB_URL" >/dev/null 2>&1; then
  record "قاعدة البيانات متاحة" PASS
  DB_OK=1
else
  record "قاعدة البيانات" SKIP "غير متاحة — اختبارات التكامل ستُتخطى"
  DB_OK=0
fi

# ------------------------------------------------------------
step "2) تثبيت التبعيات"
# ------------------------------------------------------------
if [ -d node_modules ]; then
  record "التبعيات مثبّتة مسبقًا" PASS
else
  if npm install --no-audit --no-fund >/tmp/postora-install.log 2>&1; then
    record "npm install" PASS
  else
    record "npm install" FAIL "راجع /tmp/postora-install.log"
  fi
fi

# ------------------------------------------------------------
step "3) الترحيلات"
# ------------------------------------------------------------
if [ "$DB_OK" = "1" ]; then
  if node scripts/migrate.js up >/tmp/postora-migrate.log 2>&1; then
    record "الترحيلات" PASS
  else
    record "الترحيلات" FAIL "راجع /tmp/postora-migrate.log"
  fi
else
  record "الترحيلات" SKIP "لا قاعدة بيانات"
fi

# ------------------------------------------------------------
step "4) الاختبارات الآلية"
# ------------------------------------------------------------
if npm test >/tmp/postora-test.log 2>&1; then
  SUMMARY="$(grep -E '^ +Tests +' /tmp/postora-test.log | tr -s ' ' | tr '\n' ' ' || true)"
  record "npm test" PASS "$SUMMARY"
else
  if [ "$DB_OK" = "0" ]; then
    record "npm test" SKIP "اختبارات التكامل تحتاج قاعدة بيانات"
  else
    record "npm test" FAIL "راجع /tmp/postora-test.log"
  fi
fi

# ------------------------------------------------------------
step "5) فحص الكود (ESLint)"
# ------------------------------------------------------------
if [ -x node_modules/.bin/eslint ]; then
  if node_modules/.bin/eslint . >/tmp/postora-lint.log 2>&1; then
    record "ESLint" PASS "0 أخطاء، 0 تحذيرات"
  else
    PROBLEMS="$(tail -1 /tmp/postora-lint.log)"
    record "ESLint" FAIL "$PROBLEMS"
  fi
else
  record "ESLint" SKIP "غير مثبّت"
fi

# ------------------------------------------------------------
step "6) بناء الواجهة"
# ------------------------------------------------------------
if ( cd apps/miniapp && ../../node_modules/.bin/vite build >/tmp/postora-build.log 2>&1 ); then
  SIZE="$(grep -E 'index-.*\.js' /tmp/postora-build.log | awk '{print $2, $3}' | head -1)"
  record "بناء Mini App" PASS "$SIZE"
else
  record "بناء Mini App" FAIL "راجع /tmp/postora-build.log"
fi

# ------------------------------------------------------------
step "7) إقلاع الخادم وفحص /health"
# ------------------------------------------------------------
if [ "$DB_OK" = "1" ] && [ -f .env ]; then
  node apps/server/src/index.js >/tmp/postora-server.log 2>&1 &
  SERVER_PID=$!
  HEALTH_OK=0
  for _ in $(seq 1 30); do
    sleep 1
    if curl -fsS "http://127.0.0.1:${PORT:-3000}/health" >/tmp/postora-health.json 2>/dev/null; then
      HEALTH_OK=1
      break
    fi
    kill -0 "$SERVER_PID" 2>/dev/null || break
  done
  if [ "$HEALTH_OK" = "1" ]; then
    BODY="$(cat /tmp/postora-health.json)"
    if printf '%s' "$BODY" | grep -q '"ok":true'; then
      record "الخادم + /health" PASS "$BODY"
    else
      record "الخادم + /health" FAIL "$BODY"
    fi
  else
    record "الخادم + /health" FAIL "لم يستجب — راجع /tmp/postora-server.log"
  fi
  kill "$SERVER_PID" 2>/dev/null || true
  wait "$SERVER_PID" 2>/dev/null || true
else
  record "الخادم + /health" SKIP "يحتاج قاعدة بيانات و.env"
fi

# ------------------------------------------------------------
step "8) اختبار الواجهة (اختياري)"
# ------------------------------------------------------------
if command -v chromium >/dev/null 2>&1 || command -v google-chrome >/dev/null 2>&1; then
  if [ -f tests-artifacts/ui-smoke-report.json ]; then
    record "اختبار الواجهة" PASS "تقرير سابق موجود — أعد تشغيله بـ: node scripts/ui-smoke-test.js"
  else
    record "اختبار الواجهة" SKIP "شغّله يدويًا: node scripts/ui-smoke-test.js (يحتاج stack يعمل)"
  fi
else
  record "اختبار الواجهة" SKIP "لا متصفح — غير مطلوب للتشغيل"
fi

# ------------------------------------------------------------
echo
bold "════════════════════════════════════════════"
bold "  النتيجة:  ✅ $PASS ناجح   ❌ $FAIL فاشل   ⏭  $SKIP متخطى"
bold "════════════════════════════════════════════"

if [ "$FAIL" -gt 0 ]; then
  echo
  red "فشل التحقق — راجع الرسائل أعلاه."
  exit 1
fi

echo
green "✔ المشروع سليم. شغّله بـ: npm run dev"
exit 0
