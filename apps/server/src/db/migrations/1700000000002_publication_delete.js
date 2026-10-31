/**
 * ترحيل: دعم حذف المنشورات من القناة.
 *
 * التغييرات:
 *  1) توسيع قيد الحالة ليشمل 'deleted'  (منشور حُذف من تلجرام عبر Postora).
 *  2) عمودان لتتبّع الحذف: deleted_at, deleted_messages_count.
 *
 * ملاحظة تصميمية:
 *  - لا نحذف الصف من قاعدة البيانات عند الحذف من تلجرام — نحتفظ بالأثر
 *    (سجل تدقيق + منع إعادة استخدام idempotency_key بشكل مفاجئ).
 *  - الحذف الجزئي يُسجَّل في publish_logs (stage='delete') ولا يغيّر الحالة.
 */

export const shorthands = undefined;

export const up = (pgm) => {
  // 1) القيد القديم ← الجديد (يشمل 'deleted')
  pgm.dropConstraint('publications', 'publications_status_check', { ifExists: true });
  pgm.addConstraint('publications', 'publications_status_check', {
    check: "status IN ('pending','publishing','published','failed','cancelled','deleted')"
  });

  // 2) تتبّع الحذف
  pgm.addColumns('publications', {
    deleted_at: { type: 'timestamptz' },
    deleted_messages_count: { type: 'integer' }
  });

  // 3) فهرس مساعد لسؤال «ما المنشورات القابلة للحذف؟»
  pgm.createIndex('publications', ['user_id', 'deleted_at'], {
    name: 'publications_user_deleted_idx',
    where: 'status = \'published\''
  });
};

export const down = (pgm) => {
  pgm.dropIndex('publications', ['user_id', 'deleted_at'], {
    name: 'publications_user_deleted_idx',
    ifExists: true
  });
  pgm.dropColumns('publications', ['deleted_at', 'deleted_messages_count']);
  pgm.dropConstraint('publications', 'publications_status_check', { ifExists: true });
  pgm.addConstraint('publications', 'publications_status_check', {
    check: "status IN ('pending','publishing','published','failed','cancelled')"
  });
};
