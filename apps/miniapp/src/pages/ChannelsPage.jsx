import { useState } from 'react';
import { useApp } from '../context/AppContext.jsx';
import { EmptyState } from '../components/ui/EmptyState.jsx';
import { Sheet } from '../components/ui/Sheet.jsx';
import { showConfirm, haptic } from '../lib/telegramSdk.js';

/**
 * إدارة القنوات: إضافة (بعد فحص حي في الخادم)، إعادة فحص الصلاحيات، فصل.
 * ملاحظة: التحقق من الملكية يحدث على الخادم عبر Telegram API — الواجهة لا تقرر شيئًا.
 */
export function ChannelsPage() {
  const { t, channels, connectChannel, verifyChannel, disconnectChannel, pushToast } = useApp();

  const [sheetOpen, setSheetOpen] = useState(false);
  const [chatRef, setChatRef] = useState('');
  const [busy, setBusy] = useState(null);

  async function handleAdd(event) {
    event.preventDefault();
    const value = chatRef.trim();
    if (!value) {
      pushToast(t('errors.nameRequired'), 'error');
      return;
    }

    setBusy('add');
    try {
      await connectChannel(value);
      haptic('success');
      pushToast(t('channels.connected'), 'success');
      setSheetOpen(false);
      setChatRef('');
    } catch (error) {
      haptic('error');
      pushToast(error?.message || t('errors.generic'), 'error');
    } finally {
      setBusy(null);
    }
  }

  async function handleVerify(channel) {
    setBusy(channel.id);
    try {
      const updated = await verifyChannel(channel.id);
      pushToast(
        updated.bot_can_post ? t('channels.botCanPost') : t('channels.botCannotPost'),
        updated.bot_can_post ? 'success' : 'error'
      );
    } catch (error) {
      pushToast(error?.message || t('errors.generic'), 'error');
    } finally {
      setBusy(null);
    }
  }

  async function handleRemove(channel) {
    const confirmed = await showConfirm(t('channels.removeConfirm'));
    if (!confirmed) return;

    setBusy(channel.id);
    try {
      await disconnectChannel(channel.id);
      pushToast(t('common.saved'), 'success');
    } catch (error) {
      pushToast(error?.message || t('errors.generic'), 'error');
    } finally {
      setBusy(null);
    }
  }

  const permissionChip = (channel) => {
    if (channel.bot_can_post) {
      return <span className="chip chip--success">✅ {t('channels.botCanPost')}</span>;
    }
    if (channel.bot_is_admin) {
      return <span className="chip chip--warning">⚠️ {t('channels.botCannotPost')}</span>;
    }
    return <span className="chip chip--danger">❌ {t('channels.botNotAdmin')}</span>;
  };

  return (
    <div className="stack">
      <div className="row row--between">
        <h1 style={{ fontSize: 20 }}>{t('channels.title')}</h1>
        <button
          type="button"
          className="btn btn--sm btn--primary"
          onClick={() => setSheetOpen(true)}
        >
          + {t('channels.add')}
        </button>
      </div>

      {channels.length === 0 ? (
        <EmptyState
          icon="📢"
          title={t('channels.title')}
          description={t('channels.empty')}
          action={
            <button type="button" className="btn btn--primary" onClick={() => setSheetOpen(true)}>
              + {t('channels.add')}
            </button>
          }
        />
      ) : (
        channels.map((channel) => (
          <div className="card" key={channel.id}>
            <div className="row row--between" style={{ marginBottom: 'var(--space-2)' }}>
              <div style={{ minWidth: 0 }}>
                <div className="list-item__title">{channel.title}</div>
                <div className="list-item__meta">
                  {channel.username ? `@${channel.username}` : channel.telegram_chat_id}
                </div>
              </div>
              {permissionChip(channel)}
            </div>

            <div className="row" style={{ gap: 'var(--space-2)' }}>
              <button
                type="button"
                className="btn btn--sm btn--secondary"
                onClick={() => handleVerify(channel)}
                disabled={busy === channel.id}
              >
                {busy === channel.id ? <span className="spinner" /> : '↻'} {t('channels.verify')}
              </button>
              <button
                type="button"
                className="btn btn--sm btn--danger"
                onClick={() => handleRemove(channel)}
                disabled={busy === channel.id}
              >
                {t('channels.remove')}
              </button>
            </div>
          </div>
        ))
      )}

      <Sheet
        open={sheetOpen}
        title={t('channels.addTitle')}
        onClose={() => setSheetOpen(false)}
      >
        <form className="stack" onSubmit={handleAdd}>
          <div className="alert alert--info">{t('channels.addHint', { BOT: 'Postora_1bot' })}</div>

          <div className="field">
            <label className="field__label" htmlFor="chat-ref">
              {t('channels.chatRefLabel')}
            </label>
            <input
              id="chat-ref"
              className="input"
              value={chatRef}
              onChange={(event) => setChatRef(event.target.value)}
              placeholder={t('channels.chatRefHint')}
              dir="ltr"
              autoCapitalize="none"
              autoCorrect="off"
            />
          </div>

          <button type="submit" className="btn btn--primary btn--block" disabled={busy === 'add'}>
            {busy === 'add' ? <span className="spinner" /> : '🔗'} {t('channels.add')}
          </button>
        </form>
      </Sheet>
    </div>
  );
}
