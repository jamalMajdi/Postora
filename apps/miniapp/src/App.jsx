import { useEffect, useState } from 'react';
import { useApp } from './context/AppContext.jsx';
import { AppShell } from './components/layout/AppShell.jsx';
import { ToastStack } from './components/ui/Toast.jsx';
import { DashboardPage } from './pages/DashboardPage.jsx';
import { EditorPage } from './pages/EditorPage.jsx';
import { DraftsPage } from './pages/DraftsPage.jsx';
import { ChannelsPage } from './pages/ChannelsPage.jsx';
import { PublicationsPage } from './pages/PublicationsPage.jsx';
import { getUserMessage } from '@postora/shared';
import { initTelegramWebApp, getThemeParams, isDarkTheme } from './lib/telegramSdk.js';

/**
 * الجذر: يحمّل الثيم من تلجرام، يعرض شاشات التحميل/الخطأ، ويوزّع التنقل.
 * التنقل بلا مكتبة توجيه (تطبيق من شاشة واحدة) — أبسط وأخف للـ Mini App.
 */
export default function App() {
  const { status, error, t, user, bootstrap } = useApp();
  const [route, setRoute] = useState('home');
  const [editingDraft, setEditingDraft] = useState(null);

  /* تهيئة تلجرام والثيم */
  useEffect(() => {
    initTelegramWebApp();

    const theme = getThemeParams();
    const root = document.documentElement;
    const dark = isDarkTheme();
    root.setAttribute('data-theme', dark ? 'dark' : 'light');

    if (theme) {
      if (theme.bg_color) root.style.setProperty('--color-bg', theme.bg_color);
      if (theme.secondary_bg_color) {
        root.style.setProperty('--color-bg-secondary', theme.secondary_bg_color);
      }
      if (theme.text_color) root.style.setProperty('--color-text', theme.text_color);
      if (theme.hint_color) root.style.setProperty('--color-text-secondary', theme.hint_color);
      if (theme.button_color) root.style.setProperty('--color-accent', theme.button_color);
    }
  }, []);

  if (status === 'loading') {
    return (
      <div className="center-screen">
        <div className="brand-mark">P</div>
        <span className="spinner" style={{ color: 'var(--color-accent)' }} />
        <p className="muted">{t('common.loading')}</p>
      </div>
    );
  }

  if (status === 'unauthenticated') {
    return (
      <div className="center-screen">
        <div className="brand-mark">P</div>
        <h1 style={{ fontSize: 22 }}>Postora</h1>
        <p className="note" style={{ maxWidth: 320 }}>
          {t('errors.notInTelegram')}
        </p>
        <a
          className="btn btn--primary"
          href="https://t.me/Postora_1bot"
          target="_blank"
          rel="noreferrer"
        >
          ✈️ {t('app.name')} — Telegram
        </a>
      </div>
    );
  }

  if (status === 'error') {
    return (
      <div className="center-screen">
        <div className="brand-mark">P</div>
        <div className="alert alert--error" style={{ maxWidth: 360 }}>
          {error?.code ? getUserMessage(error.code, document.documentElement.lang || 'ar') : t('errors.generic')}
        </div>
        <button type="button" className="btn btn--primary" onClick={bootstrap}>
          {t('common.retry')}
        </button>
      </div>
    );
  }

  return (
    <>
      <AppShell currentRoute={route} onNavigate={setRoute}>
        {route === 'home' ? <DashboardPage onNavigate={setRoute} /> : null}

        {route === 'editor' ? (
          <EditorPage
            key={editingDraft?.id || 'new'}
            initialDraft={editingDraft}
            onDraftSaved={() => {}}
          />
        ) : null}

        {route === 'drafts' ? (
          <DraftsPage
            onOpenDraft={(draft) => {
              setEditingDraft(draft);
              setRoute('editor');
            }}
            onNavigate={setRoute}
          />
        ) : null}

        {route === 'publications' ? <PublicationsPage /> : null}

        {route === 'channels' ? <ChannelsPage /> : null}

        {user ? (
          <p className="muted" style={{ textAlign: 'center', marginTop: 'var(--space-6)' }}>
            {t('settings.telegramId')}: {user.telegramUserId}
          </p>
        ) : null}
      </AppShell>

      <ToastStack />
    </>
  );
}
