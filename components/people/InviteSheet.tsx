import React, { useEffect, useState } from 'react';
import { Copy, Send } from 'lucide-react';
import { CosmicSheet } from '../lumia-ui/CosmicSheet';
import { lumiaSelectionHaptic } from '../../lib/haptics';
import { recordUserAppEvent } from '../../services/sessionService';
import {
  createInvite,
  inviteMessage,
  LINK_CONTEXT_OPTIONS,
  linkContextLabel,
  shareInvite,
  type LinkContext,
  type PeopleInvite,
  type ShareChannel,
} from '../../services/peopleService';

type Created = { invite: PeopleInvite; url: string };

function expiresLabel(iso: string): string {
  const date = new Date(iso);
  return Number.isNaN(date.getTime()) ? '' : date.toLocaleDateString('ru-RU', { day: 'numeric', month: 'long' });
}

/**
 * Two short steps: who this person is to you, then one tap to send the link.
 * An already open invite can be sent again without making a new one.
 */
export function InviteSheet({ open, myName, existing, inviteOrigin, onClose, onCreated }: {
  open: boolean;
  myName: string;
  existing: PeopleInvite | null;
  inviteOrigin: string;
  onClose: () => void;
  onCreated: (invite: PeopleInvite) => void;
}) {
  const [context, setContext] = useState<LinkContext>('relationship');
  const [created, setCreated] = useState<Created | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setError(null);
    setNotice(null);
    setCreated(existing ? { invite: existing, url: `${inviteOrigin}/i/${existing.code}` } : null);
  }, [open, existing, inviteOrigin]);

  const create = async () => {
    lumiaSelectionHaptic();
    setBusy(true);
    setError(null);
    try {
      const result = await createInvite(context);
      setCreated(result);
      onCreated(result.invite);
      void recordUserAppEvent({ eventType: 'share', section: 'people', source: 'invite_created', eventPayload: { kind: 'people_invite', relationship: context } });
    } catch {
      setError('Не получилось создать приглашение. Проверь интернет и попробуй ещё раз.');
    } finally {
      setBusy(false);
    }
  };

  const send = async (channel: ShareChannel) => {
    if (!created) return;
    lumiaSelectionHaptic();
    const text = inviteMessage(myName, created.url, created.invite.displayCode);
    const result = await shareInvite(channel, text, created.url);
    if (result === 'copied') setNotice('Скопировано. Вставь в любой мессенджер.');
    else if (result === 'failed' && channel === 'copy') setNotice('Не получилось скопировать. Покажи код человеку рядом.');
    else setNotice(null);
    if (result !== 'failed') {
      void recordUserAppEvent({ eventType: 'share', section: 'people', source: `invite_${channel}`, eventPayload: { kind: 'people_invite', channel } });
    }
  };

  return (
    <CosmicSheet
      open={open}
      title={created ? 'Отправь приглашение' : 'Позвать близкого'}
      subtitle={created
        ? `${linkContextLabel(created.invite.relationshipContext)} · ссылка работает до ${expiresLabel(created.invite.expiresAt)}`
        : 'Вы свяжете свои карты и будете читать один общий разбор'}
      onClose={onClose}
      closeLabel="Закрыть"
      className="people-sheet"
    >
      {!created ? (
        <div className="people-invite-step">
          <p className="people-sheet-label">Кто вы друг другу</p>
          <div className="people-context-grid" role="radiogroup" aria-label="Кто вы друг другу">
            {LINK_CONTEXT_OPTIONS.map((option) => (
              <button
                key={option.value}
                type="button"
                role="radio"
                aria-checked={context === option.value}
                className={`people-context-tile${context === option.value ? ' is-active' : ''}`}
                onClick={() => { lumiaSelectionHaptic(); setContext(option.value); }}
              >
                <strong>{option.label}</strong>
                <span>{option.hint}</span>
              </button>
            ))}
          </div>
          <ul className="people-promise">
            <li>Человек сам подтверждает связь и сам вводит свои данные рождения.</li>
            <li>Вы оба видите один и тот же разбор, без расхождений.</li>
            <li>Ваши натальные карты и личные прогнозы остаются закрытыми.</li>
          </ul>
          {error ? <p className="people-error" role="alert">{error}</p> : null}
          <button type="button" className="people-primary" onClick={() => void create()} disabled={busy}>
            {busy ? 'Создаём приглашение…' : 'Создать приглашение'}
          </button>
        </div>
      ) : (
        <div className="people-invite-step">
          <div className="people-code" aria-label={`Код приглашения ${created.invite.displayCode}`}>
            <span>Код приглашения</span>
            <strong>{created.invite.displayCode}</strong>
            <small>Если человек рядом, можно просто показать код</small>
          </div>
          <button type="button" className="people-primary" onClick={() => void send('system')}>
            <Send size={17} aria-hidden="true" />
            Отправить ссылку
          </button>
          <div className="people-share-row">
            <button type="button" className="people-share" onClick={() => void send('telegram')}>Telegram</button>
            <button type="button" className="people-share" onClick={() => void send('whatsapp')}>WhatsApp</button>
            <button type="button" className="people-share" onClick={() => void send('copy')}>
              <Copy size={15} aria-hidden="true" />
              Копировать
            </button>
          </div>
          {notice ? <p className="people-notice" role="status">{notice}</p> : null}
          <p className="people-sheet-foot">
            Когда человек примет приглашение, он появится у тебя в разделе «Близкие».
          </p>
        </div>
      )}
    </CosmicSheet>
  );
}
