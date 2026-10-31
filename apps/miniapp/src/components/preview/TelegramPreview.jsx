import { useMemo } from 'react';
import { renderPreview } from '../../lib/markdown.js';
import { useApp } from '../../context/AppContext.jsx';

/**
 * معاينة تحاكي تلجرام.
 *
 * لماذا هذا مهم (architecture.md §5):
 *  - نرسم من `text + entities` القادمة من نفس حزمة المحرك المستخدمة في الخادم.
 *  - لا نبني HTML بأنفسنا، بل نستخدم `html` المولّد من المحرك (مُهرَّب ومُعتمَد)
 *    عبر dangerouslySetInnerHTML — وهو آمن لأن المحرك يُهرّب كل مدخلات المستخدم
 *    ويسمح فقط بوسوم قائمة بيضاء.
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
          <div className="tg-message" key={index}>
            {result.messages.length > 1 ? (
              <div className="tg-message__index">
                {index + 1}/{result.messages.length} · {message.length} {t('common.chars')}
              </div>
            ) : null}
            {/* آمن: html مُولَّد من محركنا بعد هروب كامل لمدخلات المستخدم */}
            <div dangerouslySetInnerHTML={{ __html: message.html || message.text }} />
          </div>
        ))}
      </div>

      {result.warnings?.length > 0 ? (
        <div className="stack" style={{ gap: 'var(--space-2)' }}>
          {result.warnings.map((warning) => (
            <div className="tg-warning" key={warning.code}>
              ⚠️ {locale === 'ar' ? warning.messageAr : warning.messageEn}
              {warning.count > 1 ? ` (×${warning.count})` : ''}
            </div>
          ))}
        </div>
      ) : null}
    </div>
  );
}

/** شريط إحصاءات المعاينة (عدد الرسائل والمحارف). */
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
      {(result.warnings?.length ?? 0) > 0 ? (
        <span style={{ color: 'var(--color-warning)' }}>
          ⚠️ {(result.warnings || []).length}
        </span>
      ) : null}
    </div>
  );
}
