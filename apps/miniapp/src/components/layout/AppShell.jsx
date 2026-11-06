import { useApp } from '../../context/AppContext.jsx';
import { Icon, NAV_ICONS, Languages } from '../ui/icons.jsx';

/**
 * الهيكل العام — رأس + محتوى + شريط تنقل سفلي.
 *
 * قرارات التصميم:
 *  - Mobile first: شريط تنقل سفلي ثابت (نمط التطبيقات الأصلية) داخل تلجرام.
 *  - على الشاشات العريضة (≥ 900px) يتحول الشريط إلى عمود جانبي (rail) ويُوسَّط المحتوى.
 *  - الشريط الزجاجي (backdrop-filter) يعطي إحساس iOS/Telegram الأصلي مع fallback صلب.
 *  - مؤشر التمييز المتحرك (active pill) محسوب بـ flex — لا JS ولا قياسات.
 */
export function AppShell({ children, currentRoute, onNavigate, badges = {} }) {
  const { t, locale, changeLocale, channels } = useApp();

  const navItems = [
    { key: 'home', label: t('nav.home') },
    { key: 'editor', label: t('nav.editor') },
    { key: 'drafts', label: t('nav.drafts'), badge: badges.drafts },
    { key: 'publications', label: t('nav.publications') },
    { key: 'channels', label: t('nav.channels'), badge: channels.length || null }
  ];

  return (
    <div className="app-shell">
      <header className="app-header">
        <div className="app-header__brand">
          <span className="app-header__logo" aria-hidden="true">
            <span className="app-header__logo-glyph">P</span>
          </span>
          <span className="app-header__wordmark">
            Postora
            <span className="app-header__tagline">{t('app.tagline')}</span>
          </span>
        </div>

        <div className="app-header__actions">
          <button
            type="button"
            className="app-header__lang"
            onClick={() => changeLocale(locale === 'ar' ? 'en' : 'ar')}
            aria-label={t('settings.language')}
            title={t('settings.language')}
          >
            <Icon icon={Languages} size={16} />
            <span>{locale === 'ar' ? 'EN' : 'ع'}</span>
          </button>
        </div>
      </header>

      <div className="app-body">
        <main className="app-main" id="main-content">
          {children}
        </main>

        <nav className="app-nav" aria-label={t('app.name')}>
          <div className="app-nav__inner">
            {navItems.map((item) => {
              const NavIcon = NAV_ICONS[item.key];
              const active = currentRoute === item.key;
              return (
                <button
                  key={item.key}
                  type="button"
                  data-route={item.key}
                  className={`app-nav__item${active ? ' app-nav__item--active' : ''}`}
                  onClick={() => onNavigate(item.key)}
                  aria-current={active ? 'page' : undefined}
                  aria-label={item.label}
                >
                  <span className="app-nav__icon">
                    <Icon icon={NavIcon} size={20} strokeWidth={active ? 2.3 : 1.9} />
                    {item.badge ? (
                      <span className="app-nav__badge">{item.badge > 99 ? '99+' : item.badge}</span>
                    ) : null}
                  </span>
                  <span className="app-nav__label">{item.label}</span>
                </button>
              );
            })}
          </div>
        </nav>
      </div>
    </div>
  );
}
