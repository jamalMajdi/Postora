import { useApp } from '../../context/AppContext.jsx';

/**
 * الهيكل العام: رأس + محتوى + شريط تنقل سفلي.
 * مصمم للهاتف أولًا، مع دعم RTL كامل (يعتمد على dir على <html>).
 */
export function AppShell({ children, currentRoute, onNavigate, badges = {} }) {
  const { t, locale, changeLocale, channels } = useApp();

  const navItems = [
    { key: 'home', icon: '🏠', label: t('nav.home') },
    { key: 'editor', icon: '✍️', label: t('nav.editor') },
    { key: 'drafts', icon: '📝', label: t('nav.drafts'), badge: badges.drafts },
    { key: 'channels', icon: '📢', label: t('nav.channels'), badge: channels.length || null }
  ];

  return (
    <div className="app-shell">
      <header className="app-header">
        <div className="app-header__brand">
          <span className="app-header__logo" aria-hidden="true">
            P
          </span>
          <span>Postora</span>
        </div>

        <button
          type="button"
          className="btn btn--sm btn--ghost"
          onClick={() => changeLocale(locale === 'ar' ? 'en' : 'ar')}
          aria-label={t('settings.language')}
        >
          {locale === 'ar' ? 'EN' : 'ع'}
        </button>
      </header>

      <main className="app-main">{children}</main>

      <nav className="app-nav" aria-label={t('app.name')}>
        {navItems.map((item) => (
          <button
            key={item.key}
            type="button"
            className={`app-nav__item${currentRoute === item.key ? ' app-nav__item--active' : ''}`}
            onClick={() => onNavigate(item.key)}
            aria-current={currentRoute === item.key ? 'page' : undefined}
          >
            <span className="app-nav__icon" aria-hidden="true">
              {item.icon}
            </span>
            <span>{item.label}</span>
            {item.badge ? <span className="app-nav__badge">{item.badge}</span> : null}
          </button>
        ))}
      </nav>
    </div>
  );
}
