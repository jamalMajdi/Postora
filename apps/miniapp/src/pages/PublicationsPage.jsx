import { useCallback, useEffect, useState } from 'react';
import { useApp } from '../context/AppContext.jsx';
import { apiClient } from '../lib/apiClient.js';
import { EmptyState } from '../components/ui/EmptyState.jsx';

/**
 * صفحة المنشورات — سجل النشر + **حذف من القناة**.
 *
 * قرارات:
 *  - الحذف يُنفَّذ على الخادم مع فحص حي للصلاحيات؛ الواجهة لا تقرر شيئًا أمنيًا.
 *  - نطلب تأكيدًا صريحًا قبل الحذف (لا يمكن التراجع).
 *  - الحذف الجزئي يُعرض بوضوح بدل ادّعاء نجاح كامل.
 *  - بعد الحذف نحدّث الصف محليًا بدل إعادة تحميل كل القائمة.
 */
const STATUS_KEYS = ['published', 'failed', 'deleted', 'pending', 'publishing', 'cancelled'];

export function PublicationsPage() {
  const { t, locale, pushToast } = useApp();
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState(null);
  const [error, setError] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await apiClient.listPublications();
      setItems(result.publications || []);
    } catch (loadError) {
      setError(loadError.message || t('errors.generic'));
    } finally {
      setLoading(false);
    }
  }, [t]);

  useEffect(() => {
    load();
  }, [load]);

  const handleDelete = async (publication) => {
    const confirmed = window.confirm(t('publications.deleteConfirm'));
    if (!confirmed) return;

    setBusyId(publication.id);
    try {
      const result = await apiClient.deletePublication(publication.id);

      const { deletedCount = 0, alreadyDeleted = 0 } = result;
      if (deletedCount > 0) {
        pushToast(t('publications.deleted'), 'success');
      } else if (alreadyDeleted > 0) {
        pushToast(t('publications.alreadyDeleted'), 'info');
      }

      // تحديث محلي فوري
      setItems((current) =>
        current.map((item) =>
          item.id === publication.id
            ? { ...item, status: 'deleted', deletedMessagesCount: deletedCount + alreadyDeleted }
            : item
        )
      );
    } catch (deleteError) {
      pushToast(deleteError.message || t('publications.cannotDelete'), 'error');
    } finally {
      setBusyId(null);
    }
  };

  const formatDate = (value) => {
    if (!value) return '—';
    try {
      return new Date(value).toLocaleString(locale === 'ar' ? 'ar-EG' : 'en-GB', {
        dateStyle: 'medium',
        timeStyle: 'short'
      });
    } catch {
      return String(value);
    }
  };

  if (loading) {
    return (
      <div className="page">
        <div className="skeleton-card" />
        <div className="skeleton-card" />
      </div>
    );
  }

  return (
    <div className="page">
      <header className="page-header">
        <h1 className="page-title">{t('publications.title')}</h1>
        <p className="muted">{t('publications.subtitle')}</p>
      </header>

      {error ? <div className="alert alert--error">{error}</div> : null}

      {items.length === 0 ? (
        <EmptyState title={t('publications.empty')} />
      ) : (
        <ul className="list">
          {items.map((publication) => {
            const statusKey = STATUS_KEYS.includes(publication.status)
              ? publication.status
              : 'pending';
            const canDelete = publication.status === 'published';
            const busy = busyId === publication.id;

            return (
              <li key={publication.id} className="list-item">
                <div className="list-item__main">
                  <div className="list-item__title">
                    {publication.channel_title || publication.channelTitle || '—'}
                  </div>

                  <div className="list-item__meta">
                    <span className={`badge badge--${statusKey}`}>
                      {t(`publications.status.${statusKey}`)}
                    </span>
                    <span className="muted">
                      {publication.rendered_messages_count ?? 0} {t('publications.messages')} ·{' '}
                      {publication.rendered_chars ?? 0} {t('publications.chars')}
                    </span>
                    <span className="muted">{formatDate(publication.published_at || publication.created_at)}</span>
                  </div>

                  {canDelete ? (
                    <button
                      type="button"
                      className="btn btn--ghost btn--danger btn--sm"
                      disabled={busy}
                      onClick={() => handleDelete(publication)}
                    >
                      {busy ? t('publications.deleting') : `🗑 ${t('publications.delete')}`}
                    </button>
                  ) : null}
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
