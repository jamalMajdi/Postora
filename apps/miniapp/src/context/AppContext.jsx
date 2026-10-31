import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { apiClient, createSession } from '../lib/apiClient.js';
import { getUnsafeUser, isTelegramWebApp } from '../lib/telegramSdk.js';
import { detectLocale, translate, DIRECTION } from '../i18n/index.js';

/**
 * سياق التطبيق: الجلسة، اللغة، القنوات، والإشعارات.
 *
 * ملاحظة أمنية: الهوية المعروضة تأتي من استجابة الخادم (بعد التحقق من initData)،
 * لا من initDataUnsafe مباشرة.
 */
const AppContext = createContext(null);

export function AppProvider({ children }) {
  const [status, setStatus] = useState('loading'); // loading | ready | error | unauthenticated
  const [error, setError] = useState(null);
  const [user, setUser] = useState(null);
  const [stats, setStats] = useState(null);
  const [channels, setChannels] = useState([]);
  const [locale, setLocale] = useState(() => detectLocale(getUnsafeUser()?.language_code));
  const [toasts, setToasts] = useState([]);

  /* ------------------------------ الإشعارات ------------------------------ */
  const pushToast = useCallback((message, variant = 'info') => {
    const id = Math.random().toString(36).slice(2);
    setToasts((current) => [...current, { id, message, variant }]);
    setTimeout(() => {
      setToasts((current) => current.filter((toast) => toast.id !== id));
    }, 3500);
  }, []);

  const dismissToast = useCallback((id) => {
    setToasts((current) => current.filter((toast) => toast.id !== id));
  }, []);

  /* ------------------------------ الترجمة ------------------------------ */
  const t = useCallback((path, replacements) => translate(locale, path, replacements), [locale]);
  const dir = DIRECTION[locale] || 'rtl';

  useEffect(() => {
    if (typeof document === 'undefined') return;
    document.documentElement.lang = locale;
    document.documentElement.dir = dir;
  }, [locale, dir]);

  /* ------------------------------ التحميل ------------------------------ */
  const refreshAll = useCallback(async () => {
    const [me, channelList] = await Promise.all([apiClient.me(), apiClient.listChannels()]);
    setUser(me.user);
    setStats(me.stats);
    setChannels(channelList.channels || []);
    if (me.user?.locale) setLocale(me.user.locale);
    return me;
  }, []);

  const bootstrap = useCallback(async () => {
    setStatus('loading');
    setError(null);
    try {
      if (!isTelegramWebApp()) {
        setStatus('unauthenticated');
        setError({ code: 'AUTH_MISSING_INIT_DATA' });
        return;
      }
      await createSession();
      await refreshAll();
      setStatus('ready');
    } catch (err) {
      setStatus(err?.code === 'AUTH_MISSING_INIT_DATA' ? 'unauthenticated' : 'error');
      setError({ code: err?.code, message: err?.message });
    }
  }, [refreshAll]);

  useEffect(() => {
    bootstrap();
  }, [bootstrap]);

  /* ------------------------------ اللغة ------------------------------ */
  const changeLocale = useCallback(
    async (next) => {
      setLocale(next);
      try {
        await apiClient.setLocale(next);
      } catch {
        // تغيير الواجهة يكفي محليًا إذا فشل الحفظ
      }
    },
    []
  );

  /* ------------------------------ القنوات ------------------------------ */
  const connectChannel = useCallback(
    async (chatRef) => {
      const result = await apiClient.connectChannel(chatRef);
      setChannels((current) => {
        const others = current.filter((c) => c.id !== result.channel.id);
        return [...others, { ...result.channel, member_role: result.role }];
      });
      return result;
    },
    []
  );

  const refreshChannels = useCallback(async () => {
    const list = await apiClient.listChannels();
    setChannels(list.channels || []);
  }, []);

  const verifyChannel = useCallback(async (id) => {
    const result = await apiClient.verifyChannel(id);
    setChannels((current) => current.map((c) => (c.id === id ? { ...c, ...result.channel } : c)));
    return result.channel;
  }, []);

  const disconnectChannel = useCallback(async (id) => {
    await apiClient.disconnectChannel(id);
    setChannels((current) => current.filter((c) => c.id !== id));
  }, []);

  const value = useMemo(
    () => ({
      status,
      error,
      user,
      stats,
      channels,
      locale,
      dir,
      t,
      toasts,
      pushToast,
      dismissToast,
      bootstrap,
      refreshAll,
      changeLocale,
      connectChannel,
      refreshChannels,
      verifyChannel,
      disconnectChannel,
      setStats
    }),
    [
      status,
      error,
      user,
      stats,
      channels,
      locale,
      dir,
      t,
      toasts,
      pushToast,
      dismissToast,
      bootstrap,
      refreshAll,
      changeLocale,
      connectChannel,
      refreshChannels,
      verifyChannel,
      disconnectChannel
    ]
  );

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

export function useApp() {
  const context = useContext(AppContext);
  if (!context) throw new Error('useApp must be used within AppProvider');
  return context;
}
