#!/usr/bin/env bash
# ------------------------------------------------------------
# Postora — تهيئة قاعدة البيانات للتطوير/الاختبار.
# يعمل على Linux/macOS. على Windows استخدم Docker أو PostgreSQL مباشرة
# (راجع README.md قسم قاعدة البيانات).
#
# هذا السكربت آمن للتشغيل المتكرر: لا يحذف بيانات موجودة.
# ------------------------------------------------------------
set -euo pipefail

DB_NAME="${POSTORA_DB_NAME:-postora_dev}"
DB_TEST_NAME="${POSTORA_TEST_DB_NAME:-postora_test}"
DB_USER="${POSTORA_DB_USER:-postora}"
DB_PASSWORD="${POSTORA_DB_PASSWORD:-postora_dev_pw}"

echo "▶ التأكد من وجود PostgreSQL..."
if ! command -v psql >/dev/null 2>&1; then
  echo "✖ psql غير مثبت. ثبّت PostgreSQL 15+ أولًا (راجع README.md)."
  exit 1
fi

# محاولة تشغيل الخدمة إن كانت متوقفة (Linux with systemd/cluster)
if command -v pg_ctlcluster >/dev/null 2>&1; then
  sudo pg_ctlcluster "$(ls /usr/lib/postgresql | sort -V | tail -1)" main start 2>/dev/null || true
fi

echo "▶ إنشاء الدور وقواعد البيانات إن لم تكن موجودة..."
sudo -u postgres psql -v ON_ERROR_STOP=1 <<SQL >/dev/null
DO \$\$ BEGIN
  IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname='${DB_USER}') THEN
    CREATE ROLE ${DB_USER} LOGIN PASSWORD '${DB_PASSWORD}';
  END IF;
END \$\$;
SQL

for db in "$DB_NAME" "$DB_TEST_NAME"; do
  if ! sudo -u postgres psql -tAc "SELECT 1 FROM pg_database WHERE datname='${db}'" | grep -q 1; then
    sudo -u postgres createdb -O "$DB_USER" "$db"
    echo "  ✔ أُنشئت قاعدة ${db}"
  else
    echo "  • قاعدة ${db} موجودة"
  fi
done

echo "✔ قاعدة البيانات جاهزة."
echo "  DATABASE_URL=postgresql://${DB_USER}:${DB_PASSWORD}@127.0.0.1:5432/${DB_NAME}"
echo "  TEST_DATABASE_URL=postgresql://${DB_USER}:${DB_PASSWORD}@127.0.0.1:5432/${DB_TEST_NAME}"
echo ""
echo "الخطوة التالية: npm run migrate"
