import { useState } from 'react';
import { useApp } from '../context/AppContext.jsx';
import { EmptyState } from '../components/ui/EmptyState.jsx';
import { Sheet } from '../components/ui/Sheet.jsx';
import { showConfirm, haptic } from '../lib/telegramSdk.js';
import {
  Icon,
  Megaphone,
  Plus,
  RefreshCw,
  Trash2,
  ShieldCheck,
  TriangleAlert,
  CircleX,
  Link2
} from '../components/ui/icons.jsx';

/**
 * إدارة القنوات: إضافة (بعد فحص حي في الخادم)، إعادة فحص الصلاحيات، فصل.
 * ملاحظة أمنية: التحقق من الملكية يحدث على الخادم عبر Telegram API —
 * الواجهة لا تقرر شيئًا، تعرض النتيجة فقط.
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
      return (
        <span className="chip chip--success">
          <Icon icon={ShieldCheck} size={12} strokeWidth={2.4} />
          {t('channels.botCanPost')}
        </span>
      );
    }
    if (channel.bot_is_admin) {
      return (
        <span className="chip chip--warning">
          <Icon icon={TriangleAlert} size={12} strokeWidth={2.4} />
          {t('channels.botCannotPost')}
        </span>
      );
    }
    return (
      <span className="chip chip--danger">
        <Icon icon={CircleX} size={12} strokeWidth={2.4} />
        {t('channels.botNotAdmin')}
      </span>
    );
  };

  return (
    <div className="page" data-page="channels">
      <div className="page-topbar">
        <header className="page-header">
          <h1 className="page-title">{t('channels.title')}</h1>
          <p className="page-subtitle">{t('channels.addHint', { BOT: 'Postora_1bot' })}</p>
        </header>
        <button
          type="button"
          className="btn btn--primary btn--sm"
          onClick={() => setSheetOpen(true)}
        >
          <Icon icon={Plus} size={15} strokeWidth={2.5} />
          {t('channels.add')}
        </button>
      </div>

      {channels.length === 0 ? (
        <EmptyState
          icon={Megaphone}
          title={t('channels.title')}
          description={t('channels.empty')}
          action={
            <button type="button" className="btn btn--primary" onClick={() => setSheetOpen(true)}>
              <Icon icon={Plus} size={16} strokeWidth={2.4} />
              {t('channels.add')}
            </button>
          }
        />
      ) : (
        <div className="stack">
          {channels.map((channel) => (
            <div className="channel-card" key={channel.id}>
              <div className="channel-card__head">
                <span className="channel-card__avatar" aria-hidden="true">
                  <Icon icon={Megaphone} size={19} strokeWidth={2} />
                </span>
                <div className="channel-card__info">
                  <div className="channel-card__name">{channel.title}</div>
                  <div className="channel-card__handle">
                    {channel.username ? `@${channel.username}` : channel.telegram_chat_id}
                  </div>
                </div>
                {permissionChip(channel)}
              </div>

              <div className="channel-card__footer">
                <button
                  type="button"
                  className="btn btn--sm btn--secondary"
                  onClick={() => handleVerify(channel)}
                  disabled={busy === channel.id}
                >
                  {busy === channel.id ? (
                    <span className="spinner" />
                  ) : (
                    <Icon icon={RefreshCw} size={14} strokeWidth={2.3} />
                  )}
                  {t('channels.verify')}
                </button>
                <button
                  type="button"
                  className="btn btn--sm btn--danger"
                  onClick={() => handleRemove(channel)}
                  disabled={busy === channel.id}
                >
                  <Icon icon={Trash2} size={14} strokeWidth={2.2} />
                  {t('channels.remove')}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      <Sheet open={sheetOpen} title={t('channels.addTitle')} onClose={() => setSheetOpen(false)}>
        <form className="stack" onSubmit={handleAdd} style={{ gap: 'var(--ds-space-4)' }}>
          <div className="alert alert--info">
            <Icon icon={Megaphone} size={15} strokeWidth={2.2} style={{ flex: '0 0 auto' }} />
            <span>{t('channels.addHint', { BOT: 'Postora_1bot' })}</span>
          </div>

          <div className="field">
            <label className="field__label" htmlFor="chat-ref">
              {t('channels.chatRefLabel')}
            </label>
            <input
              id="chat-ref"
              className="input"
              value={chatRef}
              onChange={(event) => setChatRef(event.target.value)}
              placeholder="@my_channel"
              dir="ltr"
              autoCapitalize="none"
              autoCorrect="off"
              inputMode="text"
            />
            <span className="field__hint" dir="auto">
              {t('channels.chatRefHint')}
            </span>
          </div>

          <button type="submit" className="btn btn--primary btn--block" disabled={busy === 'add'}>
            {busy === 'add' ? (
              <span className="spinner" />
            ) : (
              <Icon icon={Link2} size={16} strokeWidth={2.3} />
            )}
            {t('channels.add')}
          </button>
        </form>
      </Sheet>
    </div>
  );
}
