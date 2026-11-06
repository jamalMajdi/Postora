import { useEffect, useState } from 'react';
import { useApp } from '../context/AppContext.jsx';
import { apiClient } from '../lib/apiClient.js';
import { EmptyState, SkeletonCard } from '../components/ui/EmptyState.jsx';
import {
  Icon,

  ArrowRight,
  ArrowLeft,
  ChevronRight,
  FileText,
  Megaphone,
  Newspaper,
  PenLine,
  RefreshCw,
  CircleCheck,
  CircleX
} from '../components/ui/icons.jsx';

/**
 * لوحة التحكم — نظرة سريعة + إجراءات بدء.
 *
 * ما تغيّر في التصميم:
 *  - بطاقة ترحيب متدرجة اللون (hero) مع شارة سياق.
 *  - بطاقات إحصاء بأيقونات Lucide وألوان دلالية.
 *  - قائمة أحدث المنشورات بشارات حالة وأيقونات بدل الإيموجي.
 *  - حالات تحميل هيكلية (skeleton) بدل نص "جارٍ التحميل".
 */
export function DashboardPage({ onNavigate }) {
  const { t, count, user, stats, channels, refreshAll, pushToast, locale, dir } = useApp();
  const [publications, setPublications] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const loadPublications = async () => {
    const result = await apiClient.listPublications();
    setPublications(result.publications || []);
  };

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

  const statusBadge = (status) => {
    const map = {
      published: { text: t('publications.status.published'), className: 'badge badge--published' },
      failed: { text: t('publications.status.failed'), className: 'badge badge--failed' },
      deleted: { text: t('publications.status.deleted'), className: 'badge badge--deleted' },
      pending: { text: t('publications.status.pending'), className: 'badge badge--pending' },
      publishing: { text: t('publications.status.publishing'), className: 'badge badge--publishing' },
      cancelled: { text: t('publications.status.cancelled'), className: 'badge badge--cancelled' }
    };
    const entry = map[status] || { text: status, className: 'badge' };
    return <span className={entry.className}>{entry.text}</span>;
  };

  const displayName = user?.firstName || user?.username || '';
  // في RTL يشير "التالي" لليسار، وفي LTR لليمين
  const Arrow = dir === 'rtl' ? ArrowLeft : ArrowRight;

  const go = (route) => onNavigate(route);

  const statCards = [
    {
      key: 'drafts',
      value: stats?.draftsCount ?? 0,
      label: t('dashboard.stats.drafts'),
      icon: FileText,
      route: 'drafts',
      tone: ''
    },
    {
      key: 'channels',
      value: channels.length,
      label: t('dashboard.stats.channels'),
      icon: Megaphone,
      route: 'channels',
      tone: ''
    },
    {
      key: 'published',
      value: stats?.publishedCount ?? 0,
      label: t('dashboard.stats.published'),
      icon: CircleCheck,
      route: 'publications',
      tone: 'stat-card--success'
    },
    {
      key: 'failed',
      value: stats?.failedCount ?? 0,
      label: t('dashboard.stats.failed'),
      icon: CircleX,
      route: 'publications',
      tone: 'stat-card--danger'
    }
  ];

  const handleRefresh = async () => {
    setRefreshing(true);
    try {
      await refreshAll();
      await loadPublications();
      pushToast(t('common.saved'), 'info');
    } catch {
      pushToast(t('errors.network'), 'error');
    } finally {
      setRefreshing(false);
    }
  };

  return (
    <div className="page" data-page="dashboard">
      {/* ---------- بطاقة الترحيب ---------- */}
      <section className="hero">
        <span className="hero__eyebrow">
          <Icon icon={Megaphone} size={11} strokeWidth={2.4} />
          {t('app.name')}
        </span>
        <h1 className="hero__title">
          {t('dashboard.welcome')}
          {displayName ? `، ${displayName}` : ''}
        </h1>
        <p className="hero__subtitle">{t('app.tagline')}</p>
        <button type="button" className="btn btn--primary btn--block" onClick={() => go('editor')}>
          <Icon icon={PenLine} size={17} strokeWidth={2.2} />
          {t('dashboard.newPost')}
        </button>
      </section>

      {/* ---------- الإحصاءات ---------- */}
      <section className="stats-grid" aria-label={t('dashboard.title')}>
        {statCards.map((card) => (
          <button
            key={card.key}
            type="button"
            className={`stat-card ${card.tone}`.trim()}
            onClick={() => go(card.route)}
            style={{ textAlign: 'start', cursor: 'pointer' }}
          >
            <span className="stat-card__icon">
              <Icon icon={card.icon} size={16} strokeWidth={2.1} />
            </span>
            <span className="stat-card__value">{card.value}</span>
            <span className="stat-card__label">{card.label}</span>
          </button>
        ))}
      </section>

      {/* ---------- بدء سريع عند غياب القنوات ---------- */}
      {channels.length === 0 ? (
        <section className="card">
          <div className="row row--nowrap" style={{ gap: 'var(--ds-space-3)' }}>
            <span className="stat-card__icon" style={{ margin: 0, flex: '0 0 auto' }}>
              <Icon icon={Megaphone} size={16} strokeWidth={2.1} />
            </span>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div className="list-item__title">{t('channels.addTitle')}</div>
              <p className="note">{t('dashboard.quickStart')}</p>
            </div>
          </div>
          <button
            type="button"
            className="btn btn--secondary btn--block"
            style={{ marginTop: 'var(--ds-space-3)' }}
            onClick={() => go('channels')}
          >
            <Icon icon={Megaphone} size={16} strokeWidth={2.1} />
            {t('channels.add')}
          </button>
        </section>
      ) : null}

      {/* ---------- أحدث المنشورات ---------- */}
      <section>
        <div className="page-topbar">
          <h2 className="section-title" style={{ margin: 0 }}>
            <Icon icon={Newspaper} size={14} strokeWidth={2.2} />
            {t('dashboard.recentPublications')}
          </h2>
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

        {loading ? (
          <div className="stack">
            <SkeletonCard lines={2} />
            <SkeletonCard lines={2} />
          </div>
        ) : publications.length === 0 ? (
          <EmptyState
            icon={Newspaper}
            title={t('dashboard.noPublications')}
            description={t('dashboard.quickStart')}
            action={
              <button type="button" className="btn btn--soft btn--sm" onClick={() => go('editor')}>
                <Icon icon={PenLine} size={15} strokeWidth={2.2} />
                {t('dashboard.newPost')}
              </button>
            }
          />
        ) : (
          <ul className="list">
            {publications.slice(0, 8).map((publication) => (
              <li className="list-item" key={publication.id}>
                <div className="list-item__main">
                  <div className="list-item__title">
                    {publication.channel_title ||
                      publication.channel_username ||
                      publication.telegram_chat_id}
                  </div>
                  <div className="list-item__meta">
                    {statusBadge(publication.status)}
                    <span>
                      {new Date(publication.created_at).toLocaleString(
                        locale === 'ar' ? 'ar-EG' : 'en-US',
                        { dateStyle: 'medium', timeStyle: 'short' }
                      )}
                    </span>
                    {publication.rendered_messages_count ? (
                      <span>{count(publication.rendered_messages_count, 'messages')}</span>
                    ) : null}
                  </div>
                </div>
                <button
                  type="button"
                  className="btn btn--ghost btn--icon btn--sm"
                  onClick={() => go('publications')}
                  aria-label={t('nav.publications')}
                >
                  <Icon icon={ChevronRight} size={16} strokeWidth={2.2} className="ds-chevron" />
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>

      {publications.length > 0 ? (
        <button type="button" className="btn btn--ghost btn--block" onClick={() => go('publications')}>
          {t('nav.publications')}
          <Icon icon={Arrow} size={16} strokeWidth={2.2} />
        </button>
      ) : null}
    </div>
  );
}
