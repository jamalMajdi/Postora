import { useMemo, useState } from 'react';
import {
  renderPreview,
  entitiesToPreviewHtml,
  firstPreviewableLink
} from '../../lib/markdown.js';
import { useApp } from '../../context/AppContext.jsx';
import { isTelegramWebApp } from '../../lib/telegramSdk.js';
import { Icon, PenLine, Eye, Columns2, Smartphone, CircleCheck, TriangleAlert } from '../ui/icons.jsx';

/**
 * معاينة تحاكي تلجرام.
 *
 * لماذا هذا مهم (architecture.md §5):
 *  - نرسم من `text + entities` القادمة من **نفس حزمة المحرك** المستخدمة في
 *    الخادم. لا يوجد محرك Markdown ثانٍ في الواجهة إطلاقًا.
 *  - نستخدم `entitiesToPreviewHtml` بدل `message.html` لأن المحرك يُنتج HTML
 *    مسطّحًا (يفتح ويغلق الوسم عند كل حدّ)، بينما العميل الحقيقي يرسم الكيان
 *    ككتلة واحدة + خط اقتباس رأسي. النتيجة هنا أقرب لتلجرام.
 *  - كل حرف نصّي يمر عبر هروب HTML كامل، والوسوم الوحيدة هي التي نولّدها.
 *  - فقاعة لكل رسالة + ترقيم + تحذيرات التنسيق.
 */
export function TelegramPreview({ markdown }) {
  const { t, locale } = useApp();

  const result = useMemo(() => renderPreview(markdown), [markdown]);

  if (result.error) {
    return (
      <div className="alert alert--error">
        {result.error === 'TOO_MANY_MESSAGES'
          ? t('editor.warnings')
          : t('errors.generic')}
      </div>
    );
  }

  if (!result.messages || result.messages.length === 0) {
    return (
      <div className="tg-preview" style={{ alignItems: 'center', justifyContent: 'center' }}>
        <p className="muted">{t('common.empty')}</p>
      </div>
    );
  }

  return (
    <div className="stack">
      <div className="tg-preview" data-testid="telegram-preview">
        {result.messages.map((message, index) => (
          <MessageBubble
            key={index}
            message={message}
            index={index}
            total={result.messages.length}
            locale={locale}
            t={t}
          />
        ))}
      </div>

      {result.warnings?.length > 0 ? (
        <div className="stack" style={{ gap: 'var(--space-2)' }}>
          {result.warnings.map((warning) => (
            <div className="tg-warning" key={warning.code}>
              <Icon icon={TriangleAlert} size={13} strokeWidth={2.4} />
              <span>
                {locale === 'ar' ? warning.messageAr : warning.messageEn}
                {warning.count > 1 ? ` (×${warning.count})` : ''}
              </span>
            </div>
          ))}
        </div>
      ) : null}
    </div>
  );
}

/**
 * فقاعة رسالة واحدة — تحاكي شكل الفقاعة في قناة تلجرام:
 * اسم القناة + النص + الوقت + عدّاد الرسائل عند التقسيم.
 */
function MessageBubble({ message, index, total, locale, t }) {
  const html = useMemo(
    () => entitiesToPreviewHtml(message.text, message.entities),
    [message.text, message.entities]
  );

  const linkCard = useMemo(() => firstPreviewableLink(message.entities), [message.entities]);

  const time = useMemo(
    () =>
      new Date().toLocaleTimeString(locale === 'ar' ? 'ar' : 'en-GB', {
        hour: '2-digit',
        minute: '2-digit'
      }),
    [locale]
  );

  return (
    <div className="tg-message" data-testid="telegram-message" data-message-index={index}>
      <div className="tg-message__meta">
        <span className="tg-message__channel">{t('preview.channelName')}</span>
        {total > 1 ? (
          <span className="tg-message__index">
            {index + 1}/{total}
          </span>
        ) : null}
      </div>

      {/* آمن: النص مُهرَّب حرفًا حرفًا؛ الوسوم مولّدة منّا فقط */}
      <div
        className="tg-message__body"
        dangerouslySetInnerHTML={{ __html: html }}
      />

      <div className="tg-message__footer">
        <span className="tg-message__time">{time}</span>
        {total > 1 ? (
          <span className="tg-message__counter">
            {message.length} {t('common.chars')}
          </span>
        ) : null}
      </div>

      {/* تلجرام لا يعرض بطاقة الرابط لأن البوت يرسل is_disabled: true */}
      {linkCard ? (
        <div className="tg-message__linkhint">
          {linkCard.kind === 'image' ? <ImageIcon /> : <LinkIcon />}
          <span>{t('preview.noLinkPreview')}</span>
        </div>
      ) : null}
    </div>
  );
}

/**
 * شريط إحصاءات المعاينة.
 * يُظهر عدد الرسائل والمحارف وتحذيرات التنسيق وحدود تلجرام.
 */
export function PreviewStats({ markdown }) {
  const { t } = useApp();
  const result = useMemo(() => renderPreview(markdown), [markdown]);

  return (
    <div className="stats-bar">
      <span>
        {t('editor.messagesCount')}: <strong>{result.stats?.messagesCount ?? 0}</strong>
      </span>
      <span>
        {t('editor.totalChars')}: <strong>{result.stats?.totalChars ?? 0}</strong>
      </span>
      {result.stats?.maxLength ? (
        <span title={t('preview.perMessage')}>
          {t('preview.maxPerMessage')}: <strong>{result.stats.maxLength}</strong>
          <span className="muted"> / 4096</span>
        </span>
      ) : null}
      {(result.warnings?.length ?? 0) > 0 ? (
        <span
          className="row"
          style={{ color: 'var(--ds-warning)', gap: 4, fontWeight: 600 }}
        >
          <Icon icon={TriangleAlert} size={12} strokeWidth={2.4} />
          {(result.warnings || []).length} {t('editor.warnings')}
        </span>
      ) : (
        <span className="row" style={{ color: 'var(--ds-success)', gap: 4, fontWeight: 600 }}>
          <Icon icon={CircleCheck} size={12} strokeWidth={2.4} />
          {t('editor.noWarnings')}
        </span>
      )}
    </div>
  );
}

/**
 * تبديل الكتابة/المعاينة — يُستخدم في رأس المحرر.
 *
 * في وضع "الكل" (split) نعرض المحرر والمعاينة معًا؛ على شاشات ضيقة
 * تتحول تلقائيًا إلى تبويبين لأن العرض المزدوج غير عملي تحت 640px.
 */
export function ViewModeSwitch({ mode, onChange, compact = false }) {
  const { t } = useApp();

  const modes = compact
    ? [
        { key: 'write', icon: PenLine, label: t('editor.write') },
        { key: 'preview', icon: Eye, label: t('editor.telegramPreview') }
      ]
    : [
        { key: 'write', icon: PenLine, label: t('editor.write') },
        { key: 'preview', icon: Eye, label: t('preview.base') },
        { key: 'split', icon: Columns2, label: t('preview.sideBySide') }
      ];

  return (
    <div className="editor-tabs" role="tablist" data-testid="view-mode-switch">
      {modes.map((item) => (
        <button
          key={item.key}
          type="button"
          role="tab"
          aria-selected={mode === item.key}
          data-view-mode={item.key}
          className={`editor-tabs__tab${mode === item.key ? ' editor-tabs__tab--active' : ''}`}
          onClick={() => onChange(item.key)}
        >
          <Icon icon={item.icon} size={15} strokeWidth={2.2} />
          <span>{item.label}</span>
        </button>
      ))}
    </div>
  );
}

/**
 * مشهد معاينة اختياري: "وضع تلجرام" يقلّد تلجرام Desktop بخلفية الدردشة،
 * و"وضع نظيف" يعرض الفقاعات فقط.
 */
export function PreviewScene({ markdown }) {
  const { t } = useApp();
  const [scene, setScene] = useState('telegram');

  return (
    <div className="stack" style={{ gap: 'var(--space-2)' }}>
      <div className="preview-scene-switch">
        <button
          type="button"
          className={`chip${scene === 'telegram' ? ' chip--active' : ''}`}
          onClick={() => setScene('telegram')}
        >
          {t('preview.telegramScene')}
        </button>
        <button
          type="button"
          className={`chip${scene === 'clean' ? ' chip--active' : ''}`}
          onClick={() => setScene('clean')}
        >
          {t('preview.cleanScene')}
        </button>
        {!isTelegramWebApp() ? (
          <span className="muted row" style={{ fontSize: 11, gap: 4 }}>
            <Icon icon={Smartphone} size={12} strokeWidth={2.2} />
            {t('preview.standaloneHint')}
          </span>
        ) : null}
      </div>

      <div className={scene === 'telegram' ? 'preview-scene preview-scene--telegram' : 'preview-scene'}>
        <TelegramPreview markdown={markdown} />
      </div>
    </div>
  );
}

/** أيقونة رابط بسيطة (SVG مضمّن — لا موارد خارجية تعمل داخل تلجرام). */
function LinkIcon() {
  return (
    <svg
      className="tg-icon"
      width="12"
      height="12"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" />
      <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" />
    </svg>
  );
}

/** أيقونة صورة. */
function ImageIcon() {
  return (
    <svg
      className="tg-icon"
      width="12"
      height="12"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <rect x="3" y="3" width="18" height="18" rx="2" />
      <circle cx="8.5" cy="8.5" r="1.5" />
      <path d="m21 15-5-5L5 21" />
    </svg>
  );
}
