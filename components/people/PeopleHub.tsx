import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { ChevronRight, KeyRound, UserPlus } from 'lucide-react';
import { getZodiacSign } from '../../constants';
import { lumiaSelectionHaptic } from '../../lib/haptics';
import { resolveDistributionChannel } from '../../lib/distributionChannel';
import { getCharts } from '../../services/storageService';
import {
  clearPendingInvite,
  fetchPeople,
  rememberHasLinkedPeople,
  linkContextLabel,
  revokeInvite,
  type LinkedPerson,
  type PeopleInvite,
  type PeopleList,
} from '../../services/peopleService';
import { AcceptInviteSheet } from './AcceptInviteSheet';
import { InviteSheet } from './InviteSheet';
import { PersonPage } from './PersonPage';
import { PeopleAvatar, birthdayLabel, daysUntilBirthday } from './PeopleAvatar';

const RUSTORE_URL = 'https://www.rustore.ru/catalog/app/ru.tvoygoroskop.app';

function expiresLabel(iso: string): string {
  const date = new Date(iso);
  return Number.isNaN(date.getTime()) ? '' : date.toLocaleDateString('ru-RU', { day: 'numeric', month: 'long' });
}

function personLine(person: LinkedPerson): string {
  const parts = [linkContextLabel(person.relationshipContext)];
  if (person.sunSign) parts.push(getZodiacSign('ru', person.sunSign));
  if (!person.hasChart) parts.push('ждём данные рождения');
  return parts.join(' · ');
}

export type PeopleHubProps = {
  me: { id: string; name: string };
  canPromotePremium: boolean;
  /** An invite code that arrived by link before this screen opened. */
  pendingInvite: string | null;
  onPendingInviteHandled: () => void;
  onRequireLogin: () => void;
  onRequestPremium: () => void;
  onAddMyBirthData: () => void;
};

/**
 * «Близкие»: people linked by invite, each with one shared reading.
 * Manual cards stay in «По дате рождения»; here only confirmed accounts.
 */
export function PeopleHub({ me, canPromotePremium, pendingInvite, onPendingInviteHandled, onRequireLogin, onRequestPremium, onAddMyBirthData }: PeopleHubProps) {
  const [data, setData] = useState<PeopleList | null>(null);
  const [loadError, setLoadError] = useState(false);
  const [inviteOpen, setInviteOpen] = useState(false);
  const [resend, setResend] = useState<PeopleInvite | null>(null);
  const [acceptCode, setAcceptCode] = useState<string | null>(null);
  const [acceptOpen, setAcceptOpen] = useState(false);
  const [openLinkId, setOpenLinkId] = useState<string | null>(null);
  const [manualCards, setManualCards] = useState<Array<{ id: string; name: string }>>([]);
  const telegram = resolveDistributionChannel() === 'telegram';

  // Names of my hand-made cards, for «это та же Маша?» on a person page.
  useEffect(() => {
    let alive = true;
    getCharts(me.id, { repairPrimary: false })
      .then((result) => {
        if (!alive) return;
        setManualCards(result.charts
          .filter((chart) => chart.subject_type === 'saved_person')
          .map((chart) => ({ id: String(chart.id), name: chart.name })));
      })
      .catch(() => undefined);
    return () => { alive = false; };
  }, [me.id]);

  const reload = useCallback(async () => {
    try {
      const result = await fetchPeople();
      setData(result);
      rememberHasLinkedPeople(result.people.length > 0);
      setLoadError(false);
      return result;
    } catch {
      setLoadError(true);
      return null;
    }
  }, []);

  useEffect(() => { void reload(); }, [reload]);

  useEffect(() => {
    if (!pendingInvite) return;
    setAcceptCode(pendingInvite);
    setAcceptOpen(true);
    onPendingInviteHandled();
  }, [pendingInvite, onPendingInviteHandled]);

  const people = useMemo(() => {
    const list = [...(data?.people || [])];
    // Closest birthdays first among people who share them, then the newest links.
    return list.sort((first, second) => {
      const a = daysUntilBirthday(first.birthday);
      const b = daysUntilBirthday(second.birthday);
      if (a != null && b != null && (a <= 14 || b <= 14)) return a - b;
      if (a != null && a <= 14) return -1;
      if (b != null && b <= 14) return 1;
      return second.linkedAt.localeCompare(first.linkedAt);
    });
  }, [data]);

  const openPerson = people.find((person) => person.linkId === openLinkId) || null;
  const canLink = data?.canLink === true;

  const startInvite = () => {
    lumiaSelectionHaptic();
    if (!canLink) { onRequireLogin(); return; }
    setResend(null);
    setInviteOpen(true);
  };

  const enterCode = () => {
    lumiaSelectionHaptic();
    setAcceptCode(null);
    setAcceptOpen(true);
  };

  const cancelInvite = async (invite: PeopleInvite) => {
    lumiaSelectionHaptic();
    try {
      await revokeInvite(invite.code);
    } finally {
      void reload();
    }
  };

  const replacePerson = (next: LinkedPerson) => {
    setData((current) => current ? { ...current, people: current.people.map((item) => item.linkId === next.linkId ? next : item) } : current);
  };

  return (
    <div className="people-hub">
      <section className="people-intro">
        <div className="people-intro-avatars" aria-hidden="true">
          <PeopleAvatar name={me.name || 'Я'} avatar={null} seed={me.id} size={46} />
          <span className="people-intro-plus">+</span>
          <span className="people-avatar is-empty" style={{ width: 46, height: 46 }}><UserPlus size={20} /></span>
        </div>
        <h2>Совместимость с близкими по-настоящему</h2>
        <p>Позови близкого в NEBO. Каждый вводит свои данные сам, а разбор у вас один на двоих: оба читаете одно и то же.</p>
      </section>

      {data == null && !loadError ? (
        <div className="people-skeleton" aria-hidden="true"><span /><span /></div>
      ) : loadError ? (
        <section className="people-empty-card">
          <strong>Не получилось загрузить близких</strong>
          <p>Проверь интернет. Все связи на месте.</p>
          <button type="button" className="people-secondary" onClick={() => void reload()}>Обновить</button>
        </section>
      ) : telegram && !canLink ? (
        <section className="people-empty-card">
          <strong>Близкие есть в приложении NEBO</strong>
          <p>Связать карты с близкими можно в приложении из RuStore. Там же вы будете читать общий разбор.</p>
          <a className="people-primary" href={RUSTORE_URL} target="_blank" rel="noopener noreferrer">Открыть RuStore</a>
        </section>
      ) : !canLink ? (
        <section className="people-empty-card">
          <strong>Войди, чтобы звать близких</strong>
          <p>Связь хранится в аккаунте. Вход через VK ID, Яндекс или почту нужен, чтобы она не потерялась при смене телефона.</p>
          <button type="button" className="people-primary" onClick={onRequireLogin}>Войти</button>
          <button type="button" className="people-text-button" onClick={enterCode}>У меня есть код приглашения</button>
        </section>
      ) : (
        <>
          {people.length ? (
            <section className="people-list" aria-label="Близкие">
              {people.map((person) => {
                const birthday = birthdayLabel(person.birthday);
                const soon = (daysUntilBirthday(person.birthday) ?? 99) <= 14;
                const waitingAnswer = person.proposedContext && !person.proposedByMe;
                return (
                  <button
                    key={person.linkId}
                    type="button"
                    className="people-row"
                    onClick={() => { lumiaSelectionHaptic(); setOpenLinkId(person.linkId); }}
                  >
                    <PeopleAvatar name={person.name} avatar={person.avatar} seed={person.linkId} size={48} />
                    <span className="people-row-copy">
                      <strong>{person.name || 'Близкий'}</strong>
                      <small>{personLine(person)}</small>
                      {waitingAnswer ? <em className="people-badge is-question">Предлагает: {linkContextLabel(person.proposedContext!)}</em>
                        : soon && birthday ? <em className="people-badge">{birthday}</em> : null}
                    </span>
                    <ChevronRight size={18} aria-hidden="true" />
                  </button>
                );
              })}
            </section>
          ) : (
            <section className="people-steps" aria-label="Как это работает">
              <ol>
                <li><strong>Позови по ссылке</strong><span>Отправь её в Telegram, WhatsApp или покажи код</span></li>
                <li><strong>Человек подтверждает</strong><span>И сам вводит свои данные рождения</span></li>
                <li><strong>Читаете общий разбор</strong><span>Один текст на двоих, без расхождений</span></li>
              </ol>
            </section>
          )}

          {data?.invites.length ? (
            <section className="people-invites" aria-label="Приглашения ждут ответа">
              <h3>Ждут ответа</h3>
              {data.invites.map((invite) => (
                <div key={invite.code} className="people-invite-row">
                  <span>
                    <strong>{linkContextLabel(invite.relationshipContext)} · {invite.displayCode}</strong>
                    <small>Ссылка работает до {expiresLabel(invite.expiresAt)}</small>
                  </span>
                  <button type="button" className="people-pill" onClick={() => { lumiaSelectionHaptic(); setResend(invite); setInviteOpen(true); }}>Отправить</button>
                  <button type="button" className="people-pill is-quiet" onClick={() => void cancelInvite(invite)}>Отменить</button>
                </div>
              ))}
            </section>
          ) : null}

          <div className="people-actions">
            <button type="button" className="people-primary" onClick={startInvite}>
              <UserPlus size={18} aria-hidden="true" />
              Позвать близкого
            </button>
            <button type="button" className="people-secondary" onClick={enterCode}>
              <KeyRound size={17} aria-hidden="true" />
              Ввести код
            </button>
          </div>
          <p className="people-privacy">Близкие видят только твоё имя, знак, день рождения и ваш общий разбор. Натальная карта и личные прогнозы остаются твоими.</p>
        </>
      )}

      <InviteSheet
        open={inviteOpen}
        myName={me.name}
        existing={resend}
        inviteOrigin={data?.inviteOrigin || 'https://api.tvoi-goroskop.ru'}
        onClose={() => { setInviteOpen(false); void reload(); }}
        onCreated={() => { void reload(); }}
      />
      <AcceptInviteSheet
        open={acceptOpen}
        code={acceptCode}
        canLink={canLink}
        onRequireLogin={() => { setAcceptOpen(false); onRequireLogin(); }}
        onClose={() => { setAcceptOpen(false); clearPendingInvite(); }}
        onAccepted={(linkId) => {
          clearPendingInvite();
          setAcceptOpen(false);
          void reload().then(() => setOpenLinkId(linkId));
        }}
        onOpenLink={(linkId) => { clearPendingInvite(); setAcceptOpen(false); setOpenLinkId(linkId); }}
      />
      {openPerson ? (
        <PersonPage
          person={openPerson}
          me={{ name: me.name, seed: me.id }}
          canPromotePremium={canPromotePremium}
          manualCardName={(chartId) => manualCards.find((card) => card.id === chartId)?.name || null}
          onClose={() => setOpenLinkId(null)}
          onChanged={replacePerson}
          onRemoved={() => { setOpenLinkId(null); void reload(); }}
          onRequestPremium={onRequestPremium}
          onAddMyBirthData={() => { setOpenLinkId(null); onAddMyBirthData(); }}
        />
      ) : null}
    </div>
  );
}
