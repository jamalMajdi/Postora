import { useEffect, useMemo, useRef, useState } from 'react';
import { useApp } from '../context/AppContext.jsx';
import { MarkdownEditor } from '../components/editor/MarkdownEditor.jsx';
import {
  TelegramPreview,
  PreviewStats,
  ViewModeSwitch
} from '../components/preview/TelegramPreview.jsx';
import {
  isMarkdownFile,
  isTooLarge,
  readMarkdownFile,
  MAX_IMPORT_BYTES
} from '../lib/fileImport.js';
import { apiClient } from '../lib/apiClient.js';
import { haptic, showConfirm } from '../lib/telegramSdk.js';
import { renderPreview, fingerprintPreview } from '../lib/markdown.js';
import {
  Icon,
  Upload,
  Save,
  Rocket,
  Scissors,
  Megaphone,
  CircleCheck,
} from '../components/ui/icons.jsx';

/**
 * محرر المقال: كتابة + معاينة مباشرة (بنفس محرك الخادم) + حفظ مسودة + نشر.
 *
 * خطوات النشر:
 *  1) التحقق من وجود قناة مختارة.
 *  2) طلب /api/preview من الخادم للتحقق من تطابق مخرجات الواجهة.
 *  3) النشر؛ عند تحذير التكرار نطلب تأكيدًا صريحًا ثم نعيد المحاولة بـ allowDuplicate.
 */
export function EditorPage({ initialDraft = null, onDraftSaved }) {
  const { t, count, channels, pushToast, refreshAll, setStats, locale } = useApp();

  const [content, setContent] = useState(initialDraft?.content_markdown || '');
  const [title, setTitle] = useState(initialDraft?.title || '');
  const [channelId, setChannelId] = useState(
    initialDraft?.target_channel_id || channels[0]?.id || ''
  );
  const [viewMode, setViewMode] = useState('write'); // 'write' | 'preview' | 'split'
  const [busy, setBusy] = useState(null); // 'draft' | 'publish' | null
  const [draftId, setDraftId] = useState(initialDraft?.id || null);
  const [draftVersion, setDraftVersion] = useState(initialDraft?.version || null);
  const [lastResult, setLastResult] = useState(null);

  useEffect(() => {
    if (!channelId && channels.length > 0) setChannelId(channels[0].id);
  }, [channels, channelId]);

  // تُحسب المعاينة من نفس محرك الخادم وتتحدث فورًا مع كل تعديل (useMemo على content)
  const clientPreview = useMemo(() => renderPreview(content), [content]);
  const isEmpty = content.trim().length === 0;
  const messagesCount = clientPreview.stats?.messagesCount ?? 0;

  /* ------------------------------ استيراد ملف .md ------------------------------ */
  const fileInputRef = useRef(null);
  const [isNarrow, setIsNarrow] = useState(
    typeof window !== 'undefined' ? window.innerWidth < 640 : false
  );

  useEffect(() => {
    const onResize = () => setIsNarrow(window.innerWidth < 640);
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  // على الشاشات الضيقة لا يوجد وضع "جنبًا إلى جنب" — نعود إلى الكتابة
  useEffect(() => {
    if (isNarrow && viewMode === 'split') setViewMode('preview');
  }, [isNarrow, viewMode]);

  async function handleImportFile(event) {
    const file = event.target.files?.[0];
    event.target.value = ''; // للسماح بإعادة اختيار الملف نفسه
    if (!file) return;

    if (!isMarkdownFile(file)) {
      pushToast(t('preview.importWrongType'), 'error');
      haptic('error');
      return;
    }
    if (isTooLarge(file)) {
      pushToast(
        t('preview.importTooBig', { size: Math.round(MAX_IMPORT_BYTES / 1024) }),
        'error'
      );
      haptic('error');
      return;
    }

    try {
      const text = await readMarkdownFile(file);
      if (!text.trim()) {
        pushToast(t('preview.importEmpty'), 'error');
        return;
      }

      // لا نمحو عمل المستخدم بلا تأكيد
      if (content.trim().length > 0) {
        const confirmed = await showConfirm(t('preview.replaceConfirm'));
        if (!confirmed) return;
      }

      setContent(text);
      if (!title) setTitle(file.name.replace(/\.(md|markdown|txt|mdown|mkd)$/i, ''));
      pushToast(t('preview.imported', { name: file.name }), 'success');
      haptic('light');
      setViewMode('preview');
    } catch {
      pushToast(t('preview.importEmpty'), 'error');
      haptic('error');
    }
  }

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
        `${t('editor.publishSuccess')} — ${count(result.messageIds?.length ?? 0, 'messages')}`,
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
      <ViewModeSwitch
        mode={isNarrow && viewMode === 'split' ? 'preview' : viewMode}
        onChange={setViewMode}
        compact={isNarrow}
      />

      <div className="editor-titlebar">
        <input
          className="input"
          value={title}
          onChange={(event) => setTitle(event.target.value)}
          placeholder={t('editor.titlePlaceholder')}
          maxLength={200}
        />
        <button
          type="button"
          className="btn btn--secondary btn--sm"
          onClick={() => fileInputRef.current?.click()}
          disabled={busy !== null}
          title={t('preview.importFile')}
        >
          <Icon icon={Upload} size={14} strokeWidth={2.3} />
          <span className="editor-titlebar__import-label">{t('preview.importFile')}</span>
        </button>
        <input
          ref={fileInputRef}
          type="file"
          accept=".md,.markdown,.txt,.mdown,.mkd,text/markdown,text/plain"
          onChange={handleImportFile}
          hidden
          data-testid="md-import-input"
        />
      </div>

      <div
        className={`editor-panes${
          viewMode === 'split' && !isNarrow ? ' editor-panes--split' : ''
        }`}
        data-view-mode={viewMode}
      >
        {viewMode === 'write' || (viewMode === 'split' && !isNarrow) ? (
          <div className="editor-panes__write">
            <MarkdownEditor value={content} onChange={setContent} disabled={busy !== null} />
          </div>
        ) : null}

        {viewMode === 'preview' || (viewMode === 'split' && !isNarrow) ? (
          <div className="editor-panes__preview" data-testid="preview-pane">
            {messagesCount > 1 ? (
              <div className="preview-split-note">
                <Icon icon={Scissors} size={13} strokeWidth={2.3} />
                {t('preview.splitNote', { n: messagesCount })}
              </div>
            ) : null}
            <TelegramPreview markdown={content} />
          </div>
        ) : null}
      </div>

      <PreviewStats markdown={content} />

      <div className="field">
        <label className="field__label" htmlFor="target-channel">
          {t('editor.targetChannel')}
        </label>
        {channels.length === 0 ? (
          <div className="alert alert--info">
            <Icon icon={Megaphone} size={15} strokeWidth={2.2} style={{ flex: '0 0 auto' }} />
            <span>{t('editor.noChannels')}</span>
          </div>
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
                {channel.bot_can_post ? '' : ' (!)'}
              </option>
            ))}
          </select>
        )}
      </div>

      {lastResult ? (
        <div className="alert alert--success">
          <Icon icon={CircleCheck} size={15} strokeWidth={2.3} style={{ flex: '0 0 auto' }} />
          <span>
            {t('editor.publishSuccess')} — {count(lastResult.messageIds?.length ?? 0, 'messages')}
          </span>
        </div>
      ) : null}

      <div className="editor-footer">
        <button
          type="button"
          className="btn btn--secondary"
          onClick={handleSaveDraft}
          disabled={busy !== null || isEmpty}
        >
          {busy === 'draft' ? (
            <span className="spinner" />
          ) : (
            <Icon icon={Save} size={16} strokeWidth={2.2} />
          )}
          {t('editor.saveDraft')}
        </button>
        <button
          type="button"
          className="btn btn--primary"
          onClick={() => handlePublish()}
          disabled={busy !== null || isEmpty || channels.length === 0}
        >
          {busy === 'publish' ? (
            <span className="spinner" />
          ) : (
            <Icon icon={Rocket} size={16} strokeWidth={2.2} />
          )}
          {t('editor.publishNow')}
        </button>
      </div>
    </div>
  );
}
