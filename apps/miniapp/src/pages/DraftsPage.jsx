import { useCallback, useEffect, useState } from 'react';
import { useApp } from '../context/AppContext.jsx';
import { apiClient } from '../lib/apiClient.js';
import { EmptyState, SkeletonCard } from '../components/ui/EmptyState.jsx';
import { showConfirm, haptic } from '../lib/telegramSdk.js';
import { Icon, FileText, PenLine, Pencil, Trash2, RefreshCw } from '../components/ui/icons.jsx';

/** قائمة المسودات: فتح، حذف. */
export function DraftsPage({ onOpenDraft, onNavigate }) {
  const { t, count, pushToast, refreshAll, locale } = useApp();
  const [drafts, setDrafts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [deletingId, setDeletingId] = useState(null);

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

    setDeletingId(draft.id);
    try {
      await apiClient.deleteDraft(draft.id);
      setDrafts((current) => current.filter((item) => item.id !== draft.id));
      haptic('light');
      pushToast(t('common.saved'), 'success');
      refreshAll().catch(() => {});
    } catch (error) {
      pushToast(error?.message || t('errors.generic'), 'error');
    } finally {
      setDeletingId(null);
    }
  }

  return (
    <div className="page" data-page="drafts">
      <div className="page-topbar">
        <header className="page-header">
          <h1 className="page-title">{t('drafts.title')}</h1>
          <p className="page-subtitle">{t('app.tagline')}</p>
        </header>
        <button
          type="button"
          className="btn btn--ghost btn--icon btn--sm"
          onClick={load}
          aria-label={t('common.retry')}
          title={t('common.retry')}
        >
          <Icon icon={RefreshCw} size={15} strokeWidth={2.2} />
        </button>
      </div>

      {loading ? (
        <div className="stack">
          <SkeletonCard lines={2} />
          <SkeletonCard lines={2} />
          <SkeletonCard lines={2} />
        </div>
      ) : drafts.length === 0 ? (
        <EmptyState
          icon={FileText}
          title={t('drafts.title')}
          description={t('drafts.empty')}
          action={
            <button type="button" className="btn btn--primary" onClick={() => onNavigate('editor')}>
              <Icon icon={PenLine} size={16} strokeWidth={2.3} />
              {t('dashboard.newPost')}
            </button>
          }
        />
      ) : (
        <ul className="list">
          {drafts.map((draft) => (
            <li className="list-item" key={draft.id}>
              <button
                type="button"
                className="list-item__main"
                onClick={() => onOpenDraft(draft)}
                style={{ textAlign: 'start', cursor: 'pointer' }}
              >
                <span className="list-item__title">{draft.title || t('drafts.untitled')}</span>
                <span className="list-item__meta">
                  <span>
                    {new Date(draft.updated_at).toLocaleDateString(
                      locale === 'ar' ? 'ar-EG' : 'en-GB',
                      { dateStyle: 'medium' }
                    )}
                  </span>
                  <span>·</span>
                  <span>{count(draft.content_markdown.length, 'chars')}</span>
                </span>
              </button>

              <div className="list-item__actions">
                <button
                  type="button"
                  className="btn btn--soft btn--icon btn--sm"
                  onClick={() => onOpenDraft(draft)}
                  aria-label={t('drafts.open')}
                  title={t('drafts.open')}
                >
                  <Icon icon={Pencil} size={14} strokeWidth={2.2} />
                </button>
                <button
                  type="button"
                  className="btn btn--danger btn--icon btn--sm"
                  onClick={() => handleDelete(draft)}
                  disabled={deletingId === draft.id}
                  aria-label={t('common.delete')}
                  title={t('common.delete')}
                >
                  {deletingId === draft.id ? (
                    <span className="spinner" />
                  ) : (
                    <Icon icon={Trash2} size={14} strokeWidth={2.2} />
                  )}
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
