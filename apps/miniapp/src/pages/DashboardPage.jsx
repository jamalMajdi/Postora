import { useEffect, useState } from 'react';
import { useApp } from '../context/AppContext.jsx';
import { apiClient } from '../lib/apiClient.js';

/** لوحة التحكم: إحصاءات سريعة + أحدث عمليات النشر + إجراءات بدء. */
export function DashboardPage({ onNavigate }) {
  const { t, user, stats, channels, refreshAll, pushToast, locale } = useApp();
  const [publications, setPublications] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        const result = await apiClient.listPublications();
        if (!cancelled) setPublications(result.publications || []);
      } catch {
        // لا نعطّل اللوحة بسبب فشل القائمة
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    refreshAll().catch(() => {});
  }, [refreshAll]);

  const statusLabel = (status) => {
    const map = {
      published: { text: t('common.publish'), className: 'chip chip--success' },
      failed: { text: t('common.error'), className: 'chip chip--danger' },
      pending: { text: '⏳', className: 'chip' },
      publishing: { text: '⏳', className: 'chip' },
      cancelled: { text: '—', className: 'chip' }
    };
    const entry = map[status] || { text: status, className: 'chip' };
    return <span className={entry.className}>{entry.text}</span>;
  };

  const displayName = user?.firstName || user?.username || '';

  return (
    <div className="stack" style={{ gap: 'var(--space-4)' }}>
      <section className="hero">
        <div className="hero__title">
          {t('dashboard.welcome')}
          {displayName ? `، ${displayName}` : ''} 👋
        </div>
        <div className="hero__subtitle">{t('app.tagline')}</div>
        <button
          type="button"
          className="btn btn--primary"
          onClick={() => onNavigate('editor')}
          style={{ width: '100%' }}
        >
          ✍️ {t('dashboard.newPost')}
        </button>
      </section>

      <section className="stats-grid">
        <div className="stat-card">
          <div className="stat-card__value">{stats?.draftsCount ?? 0}</div>
          <div className="stat-card__label">{t('dashboard.stats.drafts')}</div>
        </div>
        <div className="stat-card">
          <div className="stat-card__value">{channels.length}</div>
          <div className="stat-card__label">{t('dashboard.stats.channels')}</div>
        </div>
        <div className="stat-card">
          <div className="stat-card__value">{stats?.publishedCount ?? 0}</div>
          <div className="stat-card__label">{t('dashboard.stats.published')}</div>
        </div>
        <div className="stat-card">
          <div className="stat-card__value">{stats?.failedCount ?? 0}</div>
          <div className="stat-card__label">{t('dashboard.stats.failed')}</div>
        </div>
      </section>

      {channels.length === 0 ? (
        <div className="card">
          <p className="note" style={{ marginBottom: 'var(--space-3)' }}>
            {t('dashboard.quickStart')}
          </p>
          <button
            type="button"
            className="btn btn--secondary btn--block"
            onClick={() => onNavigate('channels')}
          >
            📢 {t('channels.add')}
          </button>
        </div>
      ) : null}

      <section>
        <h2 className="section-title">{t('dashboard.recentPublications')}</h2>

        {loading ? (
          <p className="muted">{t('common.loading')}</p>
        ) : publications.length === 0 ? (
          <p className="muted">{t('dashboard.noPublications')}</p>
        ) : (
          <div>
            {publications.slice(0, 8).map((publication) => (
              <div className="list-item" key={publication.id}>
                <div className="list-item__body">
                  <div className="list-item__title">
                    {publication.channel_title ||
                      publication.channel_username ||
                      publication.telegram_chat_id}
                  </div>
                  <div className="list-item__meta">
                    {new Date(publication.created_at).toLocaleString(
                      locale === 'ar' ? 'ar-EG' : 'en-US'
                    )}
                    {publication.rendered_messages_count
                      ? ` · ${publication.rendered_messages_count} ${t('common.messages')}`
                      : ''}
                  </div>
                </div>
                {statusLabel(publication.status)}
              </div>
            ))}
          </div>
        )}
      </section>

      <button
        type="button"
        className="btn btn--ghost btn--block"
        onClick={async () => {
          try {
            await refreshAll();
            const result = await apiClient.listPublications();
            setPublications(result.publications || []);
            pushToast(t('common.saved'), 'info');
          } catch {
            pushToast(t('errors.network'), 'error');
          }
        }}
      >
        ↻ {t('common.retry')}
      </button>
    </div>
  );
}
