import React, { useEffect, useState } from 'react';
import { CosmicSheet } from '../lumia-ui/CosmicSheet';
import { lumiaSelectionHaptic } from '../../lib/haptics';
import { recordUserAppEvent } from '../../services/sessionService';
import {
  acceptInvite,
  declineInvite,
  LINK_CONTEXT_OPTIONS,
  normalizeInviteCodeInput,
  PeopleRequestError,
  previewInvite,
  type InvitePreview,
  type LinkContext,
} from '../../services/peopleService';
import { PeopleAvatar } from './PeopleAvatar';

const STATUS_COPY: Record<Exclude<InvitePreview['status'], 'active' | 'already_linked'>, (name: string) => string> = {
  expired: (name) => `Приглашение устарело. Попроси ${name || 'человека'} прислать новое, это займёт пару секунд.`,
  used: () => 'Это приглашение уже принял другой человек. Попроси прислать новое.',
  declined: () => 'От этого приглашения уже отказались. Если хочешь связаться, попроси прислать новое.',
  revoked: () => 'Это приглашение отменено. Если хочешь связаться, попроси прислать новое.',
  own: () => 'Это твоё приглашение. Отправь ссылку тому, с кем хочешь связаться.',
};

function errorCopy(error: unknown): string {
  const code = error instanceof PeopleRequestError ? error.code : '';
  if (code === 'INVITE_NOT_FOUND') return 'Такого кода нет. Проверь, все ли символы введены верно.';
  if (code === 'INVITE_EXPIRED') return 'Приглашение устарело. Попроси прислать новое.';
  if (code === 'INVITE_USED' || code === 'INVITE_DECLINED' || code === 'INVITE_REVOKED') return 'Это приглашение больше не действует. Попроси прислать новое.';
  if (code === 'LINK_LIMIT') return 'Слишком много связей. Удали кого-нибудь из близких и попробуй снова.';
  return 'Не получилось. Проверь интернет и попробуй ещё раз.';
}

/**
 * Opens from an invite link or a code typed by hand. Says exactly what the other
 * person will see before anything is linked.
 */
export function AcceptInviteSheet({ open, code: initialCode, canLink, onRequireLogin, onClose, onAccepted, onOpenLink }: {
  open: boolean;
  code: string | null;
  canLink: boolean;
  onRequireLogin: () => void;
  onClose: () => void;
  onAccepted: (linkId: string) => void;
  onOpenLink: (linkId: string) => void;
}) {
  const [code, setCode] = useState<string | null>(initialCode);
  const [typed, setTyped] = useState('');
  const [preview, setPreview] = useState<InvitePreview | null>(null);
  const [context, setContext] = useState<LinkContext | null>(null);
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setCode(initialCode);
    setTyped('');
    setPreview(null);
    setError(null);
  }, [open, initialCode]);

  useEffect(() => {
    if (!open || !code) return;
    let alive = true;
    setLoading(true);
    setError(null);
    previewInvite(code)
      .then((result) => {
        if (!alive) return;
        setPreview(result);
        setContext(result.relationshipContext);
        void recordUserAppEvent({ eventType: 'invite_open', section: 'people', source: initialCode ? 'link' : 'code', eventPayload: { status: result.status } });
      })
      .catch((reason) => { if (alive) { setPreview(null); setError(errorCopy(reason)); } })
      .finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, [open, code, initialCode]);

  const submitCode = (event: React.FormEvent) => {
    event.preventDefault();
    const normalized = normalizeInviteCodeInput(typed);
    if (!normalized) {
      setError('В коде 8 символов, например K7M2-PQ4X.');
      return;
    }
    lumiaSelectionHaptic();
    setCode(normalized);
  };

  const accept = async () => {
    if (!code || !preview) return;
    lumiaSelectionHaptic();
    setBusy(true);
    setError(null);
    try {
      const result = await acceptInvite(code, context && context !== preview.relationshipContext ? context : null);
      void recordUserAppEvent({ eventType: 'person_added', section: 'people', source: 'invite_accepted', eventPayload: { kind: 'linked', relationship: context, created: result.created } });
      onAccepted(result.linkId);
    } catch (reason) {
      if (reason instanceof PeopleRequestError && reason.code === 'LOGIN_REQUIRED') {
        onRequireLogin();
        return;
      }
      setError(errorCopy(reason));
    } finally {
      setBusy(false);
    }
  };

  const decline = async () => {
    if (!code) return;
    lumiaSelectionHaptic();
    try { await declineInvite(code); } catch { /* closing is enough */ }
    void recordUserAppEvent({ eventType: 'invite_open', section: 'people', source: 'invite_declined', eventPayload: { status: 'declined' } });
    onClose();
  };

  const name = preview?.inviterName || '';
  const title = !code ? 'Ввести код' : preview?.status === 'active' ? (name ? `${name} зовёт тебя в близкие` : 'Тебя зовут в близкие') : 'Приглашение';

  return (
    <CosmicSheet open={open} title={title} onClose={onClose} closeLabel="Закрыть" className="people-sheet">
      {!code ? (
        <form className="people-code-form" onSubmit={submitCode}>
          <label htmlFor="people-code-input">Код из приглашения</label>
          <input
            id="people-code-input"
            value={typed}
            onChange={(event) => { setTyped(event.target.value.toUpperCase().slice(0, 9)); setError(null); }}
            placeholder="K7M2-PQ4X"
            autoCapitalize="characters"
            autoComplete="off"
            autoCorrect="off"
            spellCheck={false}
            inputMode="text"
            maxLength={9}
          />
          {error ? <p className="people-error" role="alert">{error}</p> : null}
          <button type="submit" className="people-primary">Найти приглашение</button>
        </form>
      ) : loading ? (
        <p className="people-loading" role="status">Открываем приглашение…</p>
      ) : !preview ? (
        <div className="people-invite-step">
          {error ? <p className="people-error" role="alert">{error}</p> : null}
          <button type="button" className="people-secondary" onClick={() => { setCode(null); setError(null); }}>Ввести код заново</button>
        </div>
      ) : preview.status === 'already_linked' && preview.linkId ? (
        <div className="people-invite-step">
          <p className="people-sheet-text">{name || "Этот человек"} уже у тебя в близких. Общий разбор ждёт вас обоих.</p>
          <button type="button" className="people-primary" onClick={() => onOpenLink(preview.linkId!)}>Открыть общий разбор</button>
        </div>
      ) : preview.status !== 'active' ? (
        <div className="people-invite-step">
          <p className="people-sheet-text">{STATUS_COPY[preview.status as keyof typeof STATUS_COPY](name)}</p>
          <button type="button" className="people-secondary" onClick={onClose}>Понятно</button>
        </div>
      ) : (
        <div className="people-invite-step">
          <div className="people-invite-hero">
            <PeopleAvatar name={name} avatar={preview.inviterAvatar} seed={code} size={64} />
            <p>{name || 'Человек'} хочет связать ваши карты. У вас будет один общий разбор совместимости: оба читаете одно и то же.</p>
          </div>
          <p className="people-sheet-label">Кто вы друг другу</p>
          <div className="people-context-grid is-compact" role="radiogroup" aria-label="Кто вы друг другу">
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
                {option.value === preview.relationshipContext ? <span>Так предлагает {name}</span> : null}
              </button>
            ))}
          </div>
          <div className="people-visibility">
            <strong>Что увидит {name || 'человек'}</strong>
            <span>Твоё имя, знак зодиака, день рождения (его можно скрыть) и ваш общий разбор.</span>
            <strong>Что останется только твоим</strong>
            <span>Натальная карта, личные прогнозы и вопросы.</span>
          </div>
          {!canLink ? (
            <>
              <p className="people-sheet-text">Чтобы связь не потерялась, войди через VK ID, Яндекс или почту. Это займёт минуту.</p>
              <button type="button" className="people-primary" onClick={onRequireLogin}>Войти и принять</button>
            </>
          ) : (
            <button type="button" className="people-primary" onClick={() => void accept()} disabled={busy}>
              {busy ? 'Связываем…' : 'Принять'}
            </button>
          )}
          {error ? <p className="people-error" role="alert">{error}</p> : null}
          <button type="button" className="people-text-button" onClick={() => void decline()}>Отказаться</button>
        </div>
      )}
    </CosmicSheet>
  );
}
