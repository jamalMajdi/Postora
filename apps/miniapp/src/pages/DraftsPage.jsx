import { useCallback, useEffect, useState } from 'react';
import { useApp } from '../context/AppContext.jsx';
import { apiClient } from '../lib/apiClient.js';
import { EmptyState } from '../components/ui/EmptyState.jsx';
import { showConfirm, haptic } from '../lib/telegramSdk.js';

/** قائمة المسودات: فتح، حذف. */
export function DraftsPage({ onOpenDraft, onNavigate }) {
  const { t, pushToast, refreshAll } = useApp();
  const [drafts, setDrafts] = useState([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const result = await apiClient.listDrafts();
      setDrafts(result.drafts || []);
    } catch (error) {
      pushToast(error?.message || t('errors.generic'), 'error');
    } finally {
      setLoading(false);
    }
  }, [pushToast, t]);

  useEffect(() => {
    load();
  }, [load]);

  async function handleDelete(draft) {
    const confirmed = await showConfirm(t('drafts.deleteConfirm'));
    if (!confirmed) return;

    try {
      await apiClient.deleteDraft(draft.id);
      setDrafts((current) => current.filter((item) => item.id !== draft.id));
      haptic('light');
      pushToast(t('common.saved'), 'success');
      refreshAll().catch(() => {});
    } catch (error) {
      pushToast(error?.message || t('errors.generic'), 'error');
    }
  }

  if (loading) {
    return <p className="muted">{t('common.loading')}</p>;
  }

  if (drafts.length === 0) {
    return (
      <EmptyState
        icon="📝"
        title={t('drafts.title')}
        description={t('drafts.empty')}
        action={
          <button type="button" className="btn btn--primary" onClick={() => onNavigate('editor')}>
            ✍️ {t('dashboard.newPost')}
          </button>
        }
      />
    );
  }

  return (
    <div className="stack">
      <div className="row row--between">
        <h1 style={{ fontSize: 20 }}>{t('drafts.title')}</h1>
        <button type="button" className="btn btn--sm btn--ghost" onClick={load}>
          ↻
        </button>
      </div>

      {drafts.map((draft) => (
        <div className="list-item" key={draft.id}>
          <div className="list-item__body">
            <div className="list-item__title">{draft.title || t('drafts.untitled')}</div>
            <div className="list-item__meta">
              {t('drafts.updatedAt')}:{' '}
              {new Date(draft.updated_at).toLocaleDateString('ar-EG')} ·{' '}
              {draft.content_markdown.length} {t('common.chars')}
            </div>
          </div>

          <div className="row" style={{ gap: 4 }}>
            <button
              type="button"
              className="btn btn--sm btn--secondary"
              onClick={() => onOpenDraft(draft)}
            >
              {t('drafts.open')}
            </button>
            <button
              type="button"
              className="btn btn--sm btn--danger"
              onClick={() => handleDelete(draft)}
              aria-label={t('common.delete')}
            >
              🗑
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}
