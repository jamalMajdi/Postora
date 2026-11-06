import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { formatCount, translations, DIRECTION } from '../src/i18n/index.js';

const HERE = dirname(fileURLToPath(import.meta.url));
const SRC = resolve(HERE, '../src');

const tokens = readFileSync(resolve(SRC, 'styles/tokens.css'), 'utf8');
const base = readFileSync(resolve(SRC, 'styles/base.css'), 'utf8');

const read = (p) => readFileSync(resolve(SRC, p), 'utf8');

/* ============================================================ */
/* 1) رموز التصميم                                              */
/* ============================================================ */

describe('Design Tokens', () => {
  const REQUIRED = [
    '--ds-bg',
    '--ds-surface',
    '--ds-surface-raised',
    '--ds-text',
    '--ds-text-secondary',
    '--ds-border',
    '--ds-accent',
    '--ds-accent-hover',
    '--ds-success',
    '--ds-warning',
    '--ds-danger',
    '--ds-space-1',
    '--ds-space-4',
    '--ds-space-6',
    '--ds-radius-sm',
    '--ds-radius-md',
    '--ds-radius-lg',
    '--ds-radius-full',
    '--ds-shadow-sm',
    '--ds-shadow-md',
    '--ds-font-sans',
    '--ds-font-arabic',
    '--ds-font-mono',
    '--ds-dur-fast',
    '--ds-dur-base',
    '--ds-ease-out',
    '--ds-header-h',
    '--ds-nav-h',
    '--ds-tap-min'
  ];

  it.each(REQUIRED)('يعرّف الرمز %s', (name) => {
    expect(tokens).toContain(`${name}:`);
  });

  it('يعرّف الوضع الداكن عبر [data-theme="dark"]', () => {
    expect(tokens).toContain("[data-theme='dark']");
  });

  it('يحتوي على أسماء توافق خلفي للمتغيرات القديمة', () => {
    // الصفحات القديمة تستخدم --color-* — يجب أن تبقى معرَّفة
    expect(tokens).toContain('--color-accent:');
    expect(tokens).toContain('--color-text:');
    expect(tokens).toContain('--space-4:');
    expect(tokens).toContain('--radius-md:');
  });

  it('الوضع الداكن يعيد تعريف الأسطح والنص والحدود', () => {
    const darkBlock = tokens.slice(tokens.indexOf("[data-theme='dark']"));
    for (const name of ['--ds-bg:', '--ds-surface:', '--ds-text:', '--ds-border:', '--ds-accent:']) {
      expect(darkBlock).toContain(name);
    }
  });

  it('يحترم تفضيل تقليل الحركة', () => {
    expect(tokens).toContain('prefers-reduced-motion');
  });
});

/* ============================================================ */
/* 2) جودة ملفات الأنماط                                        */
/* ============================================================ */

describe('جودة الأنماط', () => {
  it('لا توجد ألوان hex مكتوبة في base.css (كلها من الرموز)', () => {
    const hex = base.match(/#[0-9a-fA-F]{3,8}\b/g) || [];
    // يُسمح فقط داخل data URI لسهم الـ select
    const outsideUri = hex.filter((value) => !base.includes(`stroke='${value}'`));
    expect(outsideUri.length).toBe(0);
  });

  it('يستخدم خصائص منطقية (inline-start/end) لدعم RTL', () => {
    const app = read('styles/app.css');
    const logical = (app.match(/inline-(start|end)/g) || []).length;
    expect(logical).toBeGreaterThan(10);
  });

  it('يحتوي على نقاط استجابة للهاتف واللوحي وسطح المكتب', () => {
    const app = read('styles/app.css');
    expect(app).toMatch(/@media \(max-width: 360px\)/);
    expect(app).toMatch(/@media \(max-width: 640px\)/);
    expect(app).toMatch(/@media \(min-width: 900px\)/);
  });

  it('يضبط الحد الأدنى لمنطقة اللمس على 44px', () => {
    expect(tokens).toContain('--ds-tap-min: 44px');
    expect(base).toMatch(/\.btn\s*{[^}]*min-height:\s*var\(--ds-tap-min\)/s);
  });

  it('يطبّق الخط العربي على اتجاه RTL', () => {
    expect(base).toMatch(/\[dir='rtl'\] body\s*{[^}]*font-family:\s*var\(--ds-font-arabic\)/s);
  });
});

/* ============================================================ */
/* 3) الأيقونات — لا إيموجي في الواجهة                          */
/* ============================================================ */

describe('الأيقونات', () => {
  const PAGES = [
    'pages/DashboardPage.jsx',
    'pages/EditorPage.jsx',
    'pages/ChannelsPage.jsx',
    'pages/DraftsPage.jsx',
    'pages/PublicationsPage.jsx',
    'components/layout/AppShell.jsx',
    'components/ui/Toast.jsx',
    'components/ui/EmptyState.jsx',
    'components/ui/Sheet.jsx',
    'components/editor/MarkdownEditor.jsx',
    'components/preview/TelegramPreview.jsx'
  ];

  // نطاق الإيموجي المستخدم في الواجهة (ليس محتوى المستخدم)
  // نطاقات الإيموجي بلا محارف مركّبة (FE0F) لتجنّب no-misleading-character-class
  const EMOJI = /[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}\u{2B00}-\u{2BFF}]/u;

  it.each(PAGES)('%s لا يستخدم إيموجي في واجهته', (file) => {
    const source = read(file);
    // استثناء التعليقات
    const withoutComments = source
      .replace(/\/\*[\s\S]*?\*\//g, '')
      .replace(/^\s*\/\/.*$/gm, '');
    expect(EMOJI.test(withoutComments)).toBe(false);
  });

  it('كل الأيقونات تأتي من وحدة موحّدة', () => {
    const icons = read('components/ui/icons.jsx');
    expect(icons).toContain("from 'lucide-react'");
    expect(icons).toContain('export function Icon');
  });

  it('أيقونات التنقل معرفة لكل المسارات الخمسة', () => {
    const icons = read('components/ui/icons.jsx');
    for (const route of ['home', 'editor', 'drafts', 'publications', 'channels']) {
      expect(icons).toContain(`${route}:`);
    }
  });
});

/* ============================================================ */
/* 4) جمع الأعداد                                               */
/* ============================================================ */

describe('جمع الأعداد (i18n)', () => {
  it('العربية: 0', () => expect(formatCount('ar', 0, 'messages')).toBe('لا رسائل'));
  it('العربية: 1', () => expect(formatCount('ar', 1, 'messages')).toBe('رسالة واحدة'));
  it('العربية: 2', () => expect(formatCount('ar', 2, 'messages')).toBe('رسالتان'));
  it('العربية: 3–10', () => expect(formatCount('ar', 5, 'messages')).toBe('5 رسائل'));
  it('العربية: 11+', () => expect(formatCount('ar', 12, 'messages')).toBe('12 رسالة'));
  it('العربية: 100', () => expect(formatCount('ar', 100, 'messages')).toBe('100 رسالة'));

  it('الإنجليزية: 1 مفرد', () => expect(formatCount('en', 1, 'messages')).toBe('1 message'));
  it('الإنجليزية: 2 جمع', () => expect(formatCount('en', 2, 'messages')).toBe('2 messages'));
  it('الإنجليزية: 0 جمع', () => expect(formatCount('en', 0, 'messages')).toBe('0 messages'));

  it('وحدات أخرى تعمل', () => {
    expect(formatCount('ar', 3, 'chars')).toBe('3 محارف');
    expect(formatCount('en', 3, 'channels')).toBe('3 channels');
    expect(formatCount('en', 1, 'drafts')).toBe('1 draft');
  });
});

/* ============================================================ */
/* 5) تكافؤ الترجمات                                            */
/* ============================================================ */

describe('تكافؤ الترجمات ar/en', () => {
  const flatten = (obj, prefix = '') =>
    Object.entries(obj).flatMap(([key, value]) => {
      const path = prefix ? `${prefix}.${key}` : key;
      return value && typeof value === 'object' && !Array.isArray(value)
        ? flatten(value, path)
        : [[path, value]];
    });

  const arKeys = flatten(translations.ar).map(([k]) => k).sort();
  const enKeys = flatten(translations.en).map(([k]) => k).sort();

  it('اللغتان تحتويان على نفس المفاتيح تمامًا', () => {
    expect(enKeys).toEqual(arKeys);
  });

  it('لا توجد قيمة فارغة في أي لغة', () => {
    for (const [key, value] of flatten(translations.ar)) {
      expect(String(value).trim().length, `ar.${key}`).toBeGreaterThan(0);
    }
    for (const [key, value] of flatten(translations.en)) {
      expect(String(value).trim().length, `en.${key}`).toBeGreaterThan(0);
    }
  });

  it('كل اللغات لها اتجاه محدد', () => {
    expect(DIRECTION.ar).toBe('rtl');
    expect(DIRECTION.en).toBe('ltr');
  });
});

/* ============================================================ */
/* 6) الحفاظ على الوظائف (لا حذف)                                 */
/* ============================================================ */

describe('الحفاظ على الوظائف الحالية', () => {
  it('المسارات الخمسة موجودة في App.jsx', () => {
    const app = read('App.jsx');
    for (const route of ['home', 'editor', 'drafts', 'publications', 'channels']) {
      expect(app).toContain(`route === '${route}'`);
    }
  });

  it('كل مفاتيح data-route موجودة في شريط التنقل', () => {
    const shell = read('components/layout/AppShell.jsx');
    expect(shell).toContain('data-route={item.key}');
  });

  it('مفاتيح اختبار الواجهة محفوظة (لا كسر لـ ui-smoke)', () => {
    expect(read('components/editor/MarkdownEditor.jsx')).toContain('editor-textarea');
    expect(read('components/preview/TelegramPreview.jsx')).toContain('stats-bar');
    expect(read('components/preview/TelegramPreview.jsx')).toContain('tg-preview');
    expect(read('components/ui/Sheet.jsx')).toContain('sheet');
    expect(read('pages/EditorPage.jsx')).toContain('data-view-mode');
  });

  it('وظائف النشر والحذف والمصادقة لم تُمسّ في apiClient', () => {
    const api = read('lib/apiClient.js');
    for (const method of [
      'publish',
      'listPublications',
      'deletePublication',
      'createDraft',
      'updateDraft',
      'deleteDraft',
      'listChannels',
      'verifyChannel',
      'disconnectChannel'
    ]) {
      expect(api).toContain(method);
    }
  });

  it('المعاينة ما زالت تستخدم محرك Markdown نفسه', () => {
    const md = read('lib/markdown.js');
    expect(md).toContain('renderToTelegram');
    expect(md).toContain('@postora/markdown-engine');
  });
});
