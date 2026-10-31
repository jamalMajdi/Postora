import { useEffect, useMemo, useState } from 'react';
import { useApp } from '../context/AppContext.jsx';
import { MarkdownEditor } from '../components/editor/MarkdownEditor.jsx';
import { TelegramPreview, PreviewStats } from '../components/preview/TelegramPreview.jsx';
import { apiClient } from '../lib/apiClient.js';
import { haptic, showConfirm } from '../lib/telegramSdk.js';
import { renderPreview, fingerprintPreview } from '../lib/markdown.js';

/**
 * محرر المقال: كتابة + معاينة مباشرة (بنفس محرك الخادم) + حفظ مسودة + نشر.
 *
 * خطوات النشر:
 *  1) التحقق من وجود قناة مختارة.
 *  2) طلب /api/preview من الخادم للتحقق من تطابق مخرجات الواجهة.
 *  3) النشر؛ عند تحذير التكرار نطلب تأكيدًا صريحًا ثم نعيد المحاولة بـ allowDuplicate.
 */
export function EditorPage({ initialDraft = null, onDraftSaved }) {
  const { t, channels, pushToast, refreshAll, setStats, locale } = useApp();

  const [content, setContent] = useState(initialDraft?.content_markdown || '');
  const [title, setTitle] = useState(initialDraft?.title || '');
  const [channelId, setChannelId] = useState(
    initialDraft?.target_channel_id || channels[0]?.id || ''
  );
  const [tab, setTab] = useState('write');
  const [busy, setBusy] = useState(null); // 'draft' | 'publish' | null
  const [draftId, setDraftId] = useState(initialDraft?.id || null);
  const [draftVersion, setDraftVersion] = useState(initialDraft?.version || null);
  const [lastResult, setLastResult] = useState(null);

  useEffect(() => {
    if (!channelId && channels.length > 0) setChannelId(channels[0].id);
  }, [channels, channelId]);

  const clientPreview = useMemo(() => renderPreview(content), [content]);
  const isEmpty = content.trim().length === 0;

  /* ------------------------------ حفظ المسودة ------------------------------ */
  async function handleSaveDraft() {
    if (isEmpty) {
      pushToast(t('errors.generic'), 'error');
      return;
    }
    setBusy('draft');
    try {
      if (draftId) {
        const result = await apiClient.updateDraft(draftId, {
          contentMarkdown: content,
          title: title || null,
          targetChannelId: channelId || null,
          version: draftVersion
        });
        setDraftVersion(result.draft.version);
        pushToast(t('common.saved'), 'success');
      } else {
        const result = await apiClient.createDraft({
          contentMarkdown: content,
          title: title || null,
          targetChannelId: channelId || null
        });
        setDraftId(result.draft.id);
        setDraftVersion(result.draft.version);
        pushToast(t('common.saved'), 'success');
      }
      haptic('light');
      onDraftSaved?.();
      await refreshAll().catch(() => {});
    } catch (error) {
      pushToast(error?.message || t('errors.generic'), 'error');
      haptic('error');
    } finally {
      setBusy(null);
    }
  }

  /* ------------------------------ النشر ------------------------------ */
  async function handlePublish({ allowDuplicate = false } = {}) {
    if (!channelId) {
      pushToast(t('editor.noChannels'), 'error');
      return;
    }
    if (isEmpty) {
      pushToast(t('errors.generic'), 'error');
      return;
    }

    setBusy('publish');
    try {
      // تحقق من تطابق المعاينة مع مخرجات الخادم (شفافية كاملة)
      let serverPreview = null;
      try {
        serverPreview = await apiClient.preview(content);
        const localFingerprint = fingerprintPreview(clientPreview);
        const serverFingerprint = fingerprintPreview(serverPreview);
        if (localFingerprint !== serverFingerprint) {
          // نكمل، لكن نُعلم المستخدم أن الخادم هو المرجع النهائي
          pushToast(
            locale === 'ar'
              ? 'تم اعتماد مخرجات الخادم كمرجع نهائي للنشر.'
              : 'Server output is used as the final reference.',
            'info'
          );
        }
      } catch {
        // إن فشلت المعاينة نكمل — النشر نفسه سيعيد التحويل
      }

      const result = await apiClient.publish({
        channelId,
        contentMarkdown: content,
        draftId: draftId || null,
        allowDuplicate,
        idempotencyKey: crypto.randomUUID()
      });

      setLastResult(result);
      haptic('success');
      pushToast(
        `${t('editor.publishSuccess')} — ${result.messageIds?.length ?? 0} ${t('common.messages')}`,
        'success'
      );

      await refreshAll().catch(() => {});
      setStats((current) =>
        current ? { ...current, publishedCount: (current.publishedCount ?? 0) + 1 } : current
      );
    } catch (error) {
      if (error?.code === 'PUBLICATION_DUPLICATE_WARNING') {
        const confirmed = await showConfirm(
          locale === 'ar'
            ? 'نشرت هذا المحتوى نفسه في هذه القناة قبل قليل. هل تريد نشره مرة أخرى؟'
            : 'You published this exact content to this channel recently. Publish again?'
        );
        if (confirmed) {
          setBusy(null);
          return handlePublish({ allowDuplicate: true });
        }
        return;
      }

      haptic('error');
      pushToast(error?.message || t('errors.generic'), 'error');
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="editor-layout">
      <div className="editor-tabs" role="tablist">
        <button
          type="button"
          role="tab"
          aria-selected={tab === 'write'}
          className={`editor-tabs__tab${tab === 'write' ? ' editor-tabs__tab--active' : ''}`}
          onClick={() => setTab('write')}
        >
          ✍️ {t('editor.write')}
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={tab === 'preview'}
          className={`editor-tabs__tab${tab === 'preview' ? ' editor-tabs__tab--active' : ''}`}
          onClick={() => setTab('preview')}
        >
          👁️ {t('editor.telegramPreview')}
        </button>
      </div>

      <input
        className="input"
        value={title}
        onChange={(event) => setTitle(event.target.value)}
        placeholder={t('editor.titlePlaceholder')}
        maxLength={200}
      />

      {tab === 'write' ? (
        <MarkdownEditor value={content} onChange={setContent} disabled={busy !== null} />
      ) : (
        <TelegramPreview markdown={content} />
      )}

      <PreviewStats markdown={content} />

      <div className="field">
        <label className="field__label" htmlFor="target-channel">
          {t('editor.targetChannel')}
        </label>
        {channels.length === 0 ? (
          <div className="alert alert--info">{t('editor.noChannels')}</div>
        ) : (
          <select
            id="target-channel"
            className="select"
            value={channelId}
            onChange={(event) => setChannelId(event.target.value)}
          >
            {channels.map((channel) => (
              <option key={channel.id} value={channel.id}>
                {channel.title}
                {channel.username ? ` (@${channel.username})` : ''}
                {channel.bot_can_post ? '' : ' — ⚠️'}
              </option>
            ))}
          </select>
        )}
      </div>

      {lastResult ? (
        <div className="alert alert--success">
          ✅ {t('editor.publishSuccess')} — {lastResult.messageIds?.length ?? 0}{' '}
          {t('common.messages')}
        </div>
      ) : null}

      <div className="editor-footer">
        <button
          type="button"
          className="btn btn--secondary"
          onClick={handleSaveDraft}
          disabled={busy !== null || isEmpty}
        >
          {busy === 'draft' ? <span className="spinner" /> : '💾'} {t('editor.saveDraft')}
        </button>
        <button
          type="button"
          className="btn btn--primary"
          onClick={() => handlePublish()}
          disabled={busy !== null || isEmpty || channels.length === 0}
        >
          {busy === 'publish' ? <span className="spinner" /> : '🚀'} {t('editor.publishNow')}
        </button>
      </div>
    </div>
  );
}
