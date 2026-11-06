import { useCallback, useEffect, useState } from 'react';
import { useApp } from '../context/AppContext.jsx';
import { apiClient } from '../lib/apiClient.js';
import { EmptyState, SkeletonCard } from '../components/ui/EmptyState.jsx';
import {
  Icon,
  Newspaper,
  Trash2,
  RefreshCw,
  Clock,
  FileText
} from '../components/ui/icons.jsx';

/**
 * صفحة المنشورات — سجل النشر + **حذف من القناة**.
 *
 * قرارات (محفوظة من النسخة السابقة):
 *  - الحذف يُنفَّذ على الخادم مع فحص حي للصلاحيات؛ الواجهة لا تقرر شيئًا أمنيًا.
 *  - نطلب تأكيدًا صريحًا قبل الحذف (لا يمكن التراجع).
 *  - الحذف الجزئي يُعرض بوضوح بدل ادّعاء نجاح كامل.
 *  - بعد الحذف نحدّث الصف محليًا بدل إعادة تحميل كل القائمة.
 */
const STATUS_KEYS = ['published', 'failed', 'deleted', 'pending', 'publishing', 'cancelled'];

export function PublicationsPage() {
  const { t, count, locale, pushToast } = useApp();
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState(null);
  const [error, setError] = useState(null);
  const [refreshing, setRefreshing] = useState(false);

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

  const handleRefresh = async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  };

  const publishedCount = items.filter((item) => item.status === 'published').length;

  return (
    <div className="page" data-page="publications">
      <div className="page-topbar">
        <header className="page-header">
          <h1 className="page-title">{t('publications.title')}</h1>
          <p className="page-subtitle">{t('publications.subtitle')}</p>
        </header>
        <button
          type="button"
          className="btn btn--ghost btn--icon btn--sm"
          onClick={handleRefresh}
          disabled={refreshing}
          aria-label={t('common.retry')}
          title={t('common.retry')}
        >
          {refreshing ? (
            <span className="spinner" />
          ) : (
            <Icon icon={RefreshCw} size={15} strokeWidth={2.2} />
          )}
        </button>
      </div>

      {error ? (
        <div className="alert alert--error">
          <Icon icon={Newspaper} size={15} strokeWidth={2.2} style={{ flex: '0 0 auto' }} />
          <span>{error}</span>
        </div>
      ) : null}

      {loading ? (
        <div className="stack">
          <SkeletonCard lines={3} />
          <SkeletonCard lines={3} />
          <SkeletonCard lines={3} />
        </div>
      ) : items.length === 0 ? (
        <EmptyState
          icon={Newspaper}
          title={t('publications.empty')}
          description={t('publications.subtitle')}
        />
      ) : (
        <>
          <div className="stats-bar">
            <span className="row" style={{ gap: 4 }}>
              <Icon icon={FileText} size={12} strokeWidth={2.2} />
              {count(items.length, 'messages')}
            </span>
            <span className="row" style={{ gap: 4 }}>
              <Icon icon={Clock} size={12} strokeWidth={2.2} />
              {t('publications.status.published')}: {publishedCount}
            </span>
          </div>

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
                    <div className="row row--between row--nowrap">
                      <span className="list-item__title">
                        {publication.channel_title || publication.channelTitle || '—'}
                      </span>
                      <span className={`badge badge--${statusKey}`}>
                        {t(`publications.status.${statusKey}`)}
                      </span>
                    </div>

                    <div className="list-item__meta">
                      <span>{count(publication.rendered_messages_count ?? 0, 'messages')}</span>
                      <span>·</span>
                      <span>{count(publication.rendered_chars ?? 0, 'chars')}</span>
                      <span>·</span>
                      <span>
                        {formatDate(publication.published_at || publication.created_at)}
                      </span>
                    </div>

                    {canDelete ? (
                      <div className="row" style={{ gap: 'var(--ds-space-2)' }}>
                        <button
                          type="button"
                          className="btn btn--danger btn--sm"
                          disabled={busy}
                          onClick={() => handleDelete(publication)}
                        >
                          {busy ? (
                            <span className="spinner" />
                          ) : (
                            <Icon icon={Trash2} size={13} strokeWidth={2.3} />
                          )}
                          {busy ? t('publications.deleting') : t('publications.delete')}
                        </button>
                      </div>
                    ) : null}
                  </div>
                </li>
              );
            })}
          </ul>
        </>
      )}
    </div>
  );
}
