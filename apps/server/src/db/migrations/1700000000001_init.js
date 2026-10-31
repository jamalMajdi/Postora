/**
 * الترحيل الأول: المخطط الأساسي لـ Postora (6 جداول).
 *
 * الفلسفة: لا جداول غير ضرورية.
 *  users            → هوية موحدة بين البوت والميني آب
 *  channels         → القناة مخزنة مرة واحدة (تُشارك إدارتها)
 *  channel_members  → من يملك حق الوصول للقناة ودوره
 *  drafts           → المحتوى القابل للتعديل (Markdown خام)
 *  publications     → كل طلب نشر ونتيجته + مفتاح منع التكرار
 *  publish_logs     → أثر التشخيص لكل محاولة نشر (بدون أسرار)
 */

export const shorthands = undefined;

export const up = (pgm) => {
  pgm.createExtension('pgcrypto', { ifNotExists: true });

  /* ----------------------------- users ----------------------------- */
  pgm.createTable('users', {
    id: { type: 'uuid', primaryKey: true, default: pgm.func('gen_random_uuid()') },
    telegram_user_id: { type: 'bigint', notNull: true, unique: true },
    username: { type: 'text' },
    first_name: { type: 'text' },
    last_name: { type: 'text' },
    language_code: { type: 'text' },
    preferred_locale: { type: 'text', notNull: true, default: 'ar' },
    is_blocked: { type: 'boolean', notNull: true, default: false },
    created_at: { type: 'timestamptz', notNull: true, default: pgm.func('now()') },
    updated_at: { type: 'timestamptz', notNull: true, default: pgm.func('now()') }
  });
  pgm.addConstraint('users', 'users_preferred_locale_check', {
    check: "preferred_locale IN ('ar','en')"
  });

  /* --------------------------- channels ---------------------------- */
  pgm.createTable('channels', {
    id: { type: 'uuid', primaryKey: true, default: pgm.func('gen_random_uuid()') },
    telegram_chat_id: { type: 'bigint', notNull: true, unique: true },
    title: { type: 'text', notNull: true },
    username: { type: 'text' },
    chat_type: { type: 'text', notNull: true },
    bot_is_admin: { type: 'boolean', notNull: true, default: false },
    bot_can_post: { type: 'boolean', notNull: true, default: false },
    permissions_checked_at: { type: 'timestamptz' },
    created_by_user_id: {
      type: 'uuid',
      references: 'users',
      onDelete: 'SET NULL'
    },
    is_active: { type: 'boolean', notNull: true, default: true },
    created_at: { type: 'timestamptz', notNull: true, default: pgm.func('now()') },
    updated_at: { type: 'timestamptz', notNull: true, default: pgm.func('now()') }
  });
  pgm.addConstraint('channels', 'channels_chat_type_check', {
    check: "chat_type IN ('channel','supergroup')"
  });

  /* ------------------------ channel_members ------------------------ */
  pgm.createTable('channel_members', {
    channel_id: {
      type: 'uuid',
      notNull: true,
      references: 'channels',
      onDelete: 'CASCADE'
    },
    user_id: {
      type: 'uuid',
      notNull: true,
      references: 'users',
      onDelete: 'CASCADE'
    },
    role: { type: 'text', notNull: true, default: 'owner' },
    verified_at: { type: 'timestamptz', notNull: true, default: pgm.func('now()') }
  });
  pgm.addConstraint('channel_members', 'channel_members_pkey', {
    primaryKey: ['channel_id', 'user_id']
  });
  pgm.addConstraint('channel_members', 'channel_members_role_check', {
    check: "role IN ('owner','admin','editor')"
  });
  pgm.createIndex('channel_members', 'user_id', { name: 'idx_channel_members_user' });

  /* ---------------------------- drafts ----------------------------- */
  pgm.createTable('drafts', {
    id: { type: 'uuid', primaryKey: true, default: pgm.func('gen_random_uuid()') },
    user_id: {
      type: 'uuid',
      notNull: true,
      references: 'users',
      onDelete: 'CASCADE'
    },
    title: { type: 'text' },
    content_markdown: { type: 'text', notNull: true },
    content_hash: { type: 'text', notNull: true },
    target_channel_id: {
      type: 'uuid',
      references: 'channels',
      onDelete: 'SET NULL'
    },
    status: { type: 'text', notNull: true, default: 'draft' },
    source: { type: 'text', notNull: true, default: 'miniapp' },
    version: { type: 'integer', notNull: true, default: 1 },
    created_at: { type: 'timestamptz', notNull: true, default: pgm.func('now()') },
    updated_at: { type: 'timestamptz', notNull: true, default: pgm.func('now()') }
  });
  pgm.addConstraint('drafts', 'drafts_status_check', {
    check: "status IN ('draft','archived')"
  });
  pgm.addConstraint('drafts', 'drafts_source_check', {
    check: "source IN ('bot','miniapp')"
  });
  pgm.createIndex('drafts', ['user_id', { name: 'updated_at', sort: 'DESC' }], {
    name: 'idx_drafts_user_updated'
  });
  pgm.createIndex('drafts', ['user_id', 'status'], { name: 'idx_drafts_user_status' });

  /* -------------------------- publications -------------------------- */
  pgm.createTable('publications', {
    id: { type: 'uuid', primaryKey: true, default: pgm.func('gen_random_uuid()') },
    user_id: {
      type: 'uuid',
      notNull: true,
      references: 'users',
      onDelete: 'CASCADE'
    },
    draft_id: { type: 'uuid', references: 'drafts', onDelete: 'SET NULL' },
    channel_id: {
      type: 'uuid',
      notNull: true,
      references: 'channels',
      onDelete: 'RESTRICT'
    },
    source: { type: 'text', notNull: true, default: 'miniapp' },
    status: { type: 'text', notNull: true, default: 'pending' },
    idempotency_key: { type: 'text', notNull: true, unique: true },
    content_hash: { type: 'text', notNull: true },
    rendered_messages_count: { type: 'integer' },
    rendered_chars: { type: 'integer' },
    telegram_chat_id: { type: 'bigint', notNull: true },
    telegram_message_ids: { type: 'bigint[]' },
    error_code: { type: 'text' },
    error_message: { type: 'text' },
    created_at: { type: 'timestamptz', notNull: true, default: pgm.func('now()') },
    confirmed_at: { type: 'timestamptz' },
    published_at: { type: 'timestamptz' },
    updated_at: { type: 'timestamptz', notNull: true, default: pgm.func('now()') }
  });
  pgm.addConstraint('publications', 'publications_status_check', {
    check: "status IN ('pending','publishing','published','failed','cancelled')"
  });
  pgm.addConstraint('publications', 'publications_source_check', {
    check: "source IN ('bot','miniapp')"
  });
  pgm.addConstraint('publications', 'publications_published_at_check', {
    check: "status <> 'published' OR published_at IS NOT NULL"
  });
  pgm.createIndex('publications', ['channel_id', { name: 'created_at', sort: 'DESC' }], {
    name: 'idx_publications_channel_created'
  });
  pgm.createIndex('publications', ['user_id', { name: 'created_at', sort: 'DESC' }], {
    name: 'idx_publications_user_created'
  });
  // فهرس جزئي لتسريع البحث عن الطلبات النشطة (منع التكرار والاستئناف)
  pgm.createIndex('publications', ['user_id', 'channel_id', 'content_hash'], {
    name: 'idx_publications_active_lookup',
    where: "status IN ('pending','publishing')"
  });
  // فهرس الكشف عن التكرار المتعمد (تحذير فقط، ليس قيدًا)
  pgm.createIndex('publications', ['channel_id', 'content_hash', { name: 'created_at', sort: 'DESC' }], {
    name: 'idx_publications_duplicate_check',
    where: "status = 'published'"
  });

  /* --------------------------- publish_logs ------------------------- */
  pgm.createTable('publish_logs', {
    id: { type: 'bigserial', primaryKey: true },
    publication_id: {
      type: 'uuid',
      notNull: true,
      references: 'publications',
      onDelete: 'CASCADE'
    },
    attempt_number: { type: 'integer', notNull: true, default: 1 },
    stage: { type: 'text', notNull: true },
    level: { type: 'text', notNull: true, default: 'info' },
    error_code: { type: 'text' },
    details: { type: 'jsonb' },
    duration_ms: { type: 'integer' },
    created_at: { type: 'timestamptz', notNull: true, default: pgm.func('now()') }
  });
  pgm.addConstraint('publish_logs', 'publish_logs_level_check', {
    check: "level IN ('info','warn','error')"
  });
  pgm.createIndex('publish_logs', ['publication_id', { name: 'created_at', sort: 'DESC' }], {
    name: 'idx_publish_logs_publication'
  });

  /* ------------------------ updated_at trigger ---------------------- */
  pgm.sql(`
    CREATE OR REPLACE FUNCTION postora_set_updated_at()
    RETURNS TRIGGER AS $$
    BEGIN
      NEW.updated_at = now();
      RETURN NEW;
    END;
    $$ LANGUAGE plpgsql;
  `);

  for (const table of ['users', 'channels', 'drafts', 'publications']) {
    pgm.sql(`
      CREATE TRIGGER ${table}_set_updated_at
      BEFORE UPDATE ON ${table}
      FOR EACH ROW EXECUTE FUNCTION postora_set_updated_at();
    `);
  }
};

export const down = (pgm) => {
  pgm.dropTable('publish_logs');
  pgm.dropTable('publications');
  pgm.dropTable('drafts');
  pgm.dropTable('channel_members');
  pgm.dropTable('channels');
  pgm.dropTable('users');
  pgm.sql('DROP FUNCTION IF EXISTS postora_set_updated_at() CASCADE;');
};
