import React, { useCallback, useEffect, useRef, useState } from 'react';
import { ChevronLeft, Lock, Sparkles } from 'lucide-react';
import { NATIVE_BACK_EVENT, type NativeBackEventDetail } from '../../lib/nativeBack';
import { lumiaSelectionHaptic } from '../../lib/haptics';
import { getZodiacSign } from '../../constants';
import { CompatibilityAnswers, CompatibilityGauge } from '../CompatibilityAnswers';
import { CompatibilityTalkCalendar } from '../CompatibilityExtras';
import { CompatibilityStoryReader } from '../CompatibilityStoryReader';
import { recordUserAppEvent } from '../../services/sessionService';
import {
  answerLinkContext,
  fetchPairReading,
  LINK_CONTEXT_OPTIONS,
  linkContextLabel,
  proposeLinkContext,
  unlinkPerson,
  updatePerson,
  type LinkContext,
  type LinkedPerson,
  type PairReading,
} from '../../services/peopleService';
import { PeopleAvatar, avatarToneIndex, birthdayLabel } from './PeopleAvatar';

const FIELD_WORDS: Record<'date' | 'time' | 'place', string> = { date: 'дата', time: 'время', place: 'место' };

function signName(sign: string | null): string | null {
  return sign ? getZodiacSign('ru', sign) : null;
}

function differsSentence(fields: Array<'date' | 'time' | 'place'>, cardName: string | null, name: string): string {
  const card = cardName ? `В твоей карточке «${cardName}»` : 'В твоей карточке';
  const what = fields.length > 1
    ? `были другие данные рождения (${fields.map((field) => FIELD_WORDS[field]).join(', ')})`
    : fields[0] === 'date' ? 'была другая дата рождения' : fields[0] === 'time' ? 'было другое время рождения' : 'было другое место рождения';
  return `${card} ${what}. Теперь считаем по данным, которые ${name} указывает в своём профиле.`;
}

function giftNote(name: string, gender: LinkedPerson['gender']): string {
  if (gender === 'male') return `${name} открыл вам полный разбор`;
  if (gender === 'female') return `${name} открыла вам полный разбор`;
  return 'Полный разбор открыт для вас обоих';
}

export function PersonPage({ person: initialPerson, me, canPromotePremium, manualCardName, onClose, onChanged, onRemoved, onRequestPremium, onAddMyBirthData }: {
  person: LinkedPerson;
  me: { name: string; seed: string };
  canPromotePremium: boolean;
  manualCardName: (chartId: string | null) => string | null;
  onClose: () => void;
  onChanged: (person: LinkedPerson) => void;
  onRemoved: (linkId: string) => void;
  onRequestPremium: () => void;
  onAddMyBirthData: () => void;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const close = useRef(onClose);
  close.current = onClose;
  const [person, setPerson] = useState(initialPerson);
  const [pair, setPair] = useState<PairReading | null>(null);
  const [loading, setLoading] = useState(true);
  const [writing, setWriting] = useState(false);
  const [failed, setFailed] = useState(false);
  const [editingContext, setEditingContext] = useState(false);
  const [confirmUnlink, setConfirmUnlink] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => { setPerson(initialPerson); }, [initialPerson]);

  useEffect(() => {
    const element = dialog.current;
    const opener = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    element?.showModal();
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const back = (event: Event) => {
      const detail = (event as CustomEvent<NativeBackEventDetail>).detail;
      if (detail?.handled) return;
      if (detail) detail.handled = true;
      event.stopImmediatePropagation();
      close.current();
    };
    window.addEventListener(NATIVE_BACK_EVENT, back, true);
    return () => {
      window.removeEventListener(NATIVE_BACK_EVENT, back, true);
      document.body.style.overflow = previousOverflow;
      element?.close();
      if (opener?.isConnected) opener.focus({ preventScroll: true });
    };
  }, []);

  const load = useCallback(async (generate: boolean) => {
    setFailed(false);
    if (generate) setWriting(true); else setLoading(true);
    try {
      const result = await fetchPairReading(person.linkId, generate);
      setPair(result);
      if (result.status === 'writing_failed') setFailed(true);
      if (result.reading) {
        void recordUserAppEvent({ eventType: 'compatibility_ready', section: 'people', source: 'pair_reading', eventPayload: { kind: 'pair', premium_from: result.premiumFrom } });
      }
      return result;
    } catch {
      setFailed(true);
      return null;
    } finally {
      setLoading(false);
      setWriting(false);
    }
  }, [person.linkId]);

  // The context is part of the reading key, so a new type reloads the reading.
  useEffect(() => {
    let alive = true;
    void (async () => {
      const first = await load(false);
      if (alive && first?.status === 'ready' && !first.reading) await load(true);
    })();
    return () => { alive = false; };
  }, [load, person.relationshipContext]);

  const change = async (work: () => Promise<LinkedPerson>) => {
    setBusy(true);
    try {
      const next = await work();
      setPerson(next);
      onChanged(next);
    } catch {
      /* the screen keeps the previous state */
    } finally {
      setBusy(false);
    }
  };

  const pickContext = (context: LinkContext) => {
    lumiaSelectionHaptic();
    setEditingContext(false);
    void change(() => proposeLinkContext(person.linkId, context));
  };

  const removeLink = async () => {
    lumiaSelectionHaptic();
    setBusy(true);
    try {
      await unlinkPerson(person.linkId);
      void recordUserAppEvent({ eventType: 'person_added', section: 'people', source: 'link_removed', eventPayload: { kind: 'unlinked' } });
      onRemoved(person.linkId);
    } catch {
      setBusy(false);
    }
  };

  const name = person.name || 'Близкий';
  const preview = pair?.preview || null;
  const reading = pair?.reading || null;
  const gaugeQuestions = reading?.questions?.length ? reading.questions : preview?.questions || [];
  const gaugeScore = typeof reading?.overallScore === 'number' ? reading.overallScore : preview?.overallScore ?? null;
  const birthday = birthdayLabel(person.birthday);
  const suggestedCard = person.suggestedManualChartId ? manualCardName(person.suggestedManualChartId) : null;
  const linkedCard = manualCardName(person.manualChartId);

  return (
    <dialog
      ref={dialog}
      className="people-person"
      aria-labelledby="people-person-title"
      onCancel={(event) => { event.preventDefault(); onClose(); }}
    >
      <div className="people-person-scroll">
        <header className="people-person-bar">
          <button type="button" className="people-back" onClick={onClose} aria-label="Назад">
            <ChevronLeft size={22} aria-hidden="true" />
          </button>
          <span>{linkContextLabel(person.relationshipContext)}</span>
        </header>

        <section className="people-person-hero">
          <div className="people-pair-avatars" aria-hidden="true">
            <PeopleAvatar name={me.name} avatar={null} seed={me.seed} size={68} />
            <PeopleAvatar
              name={name}
              avatar={person.avatar}
              seed={person.linkId}
              size={68}
              toneShift={avatarToneIndex(me.seed) === avatarToneIndex(person.linkId) ? 1 : 0}
            />
          </div>
          <h1 id="people-person-title">{me.name || 'Ты'} и {name}</h1>
          <p>
            {[signName(pair?.me.sunSign || null), signName(person.sunSign)].filter(Boolean).join(' и ') || 'Ждём данные рождения'}
          </p>
          {birthday ? <span className="people-chip-soft">{birthday}</span> : null}
        </section>

        {person.proposedContext && !person.proposedByMe ? (
          <section className="people-banner is-question">
            <p>{name} предлагает считать вас так: «{linkContextLabel(person.proposedContext)}». Разбор перепишется под это.</p>
            <div>
              <button type="button" className="people-pill is-dark" disabled={busy} onClick={() => { lumiaSelectionHaptic(); void change(() => answerLinkContext(person.linkId, true)); }}>Согласиться</button>
              <button type="button" className="people-pill" disabled={busy} onClick={() => { lumiaSelectionHaptic(); void change(() => answerLinkContext(person.linkId, false)); }}>Оставить как есть</button>
            </div>
          </section>
        ) : null}
        {person.proposedContext && person.proposedByMe ? (
          <section className="people-banner">
            <p>Ждём, когда {name} согласится на «{linkContextLabel(person.proposedContext)}». Пока разбор остаётся прежним.</p>
            <div>
              <button type="button" className="people-pill" disabled={busy} onClick={() => pickContext(person.relationshipContext)}>Отменить</button>
            </div>
          </section>
        ) : null}

        {suggestedCard && !person.manualChartId ? (
          <section className="people-banner">
            <p>У тебя уже есть карточка «{suggestedCard}» с той же датой рождения. Это {name}?</p>
            <div>
              <button type="button" className="people-pill is-dark" disabled={busy} onClick={() => { lumiaSelectionHaptic(); void change(() => updatePerson(person.linkId, { manualChartId: person.suggestedManualChartId })); }}>Да, это {name}</button>
            </div>
          </section>
        ) : null}
        {pair?.manualCardDiffers.length ? (
          <section className="people-banner is-info">
            <p>{differsSentence(pair.manualCardDiffers, linkedCard, name)}</p>
          </section>
        ) : null}
        {pair?.updateNotes.length ? (
          <section className="people-banner is-info">
            <strong>Общий разбор обновлён</strong>
            {pair.updateNotes.map((note) => <p key={note}>{note}</p>)}
          </section>
        ) : null}

        {loading ? (
          <section className="people-status" role="status"><span className="people-spinner" aria-hidden="true" />Открываем ваш общий разбор…</section>
        ) : pair?.status === 'missing_data' ? (
          <section className="people-empty-card">
            {pair.missing.includes('me') ? (
              <>
                <strong>Добавь свои данные рождения</strong>
                <p>Без них не посчитать, как вы подходите друг другу. Это займёт минуту.</p>
                <button type="button" className="people-primary" onClick={onAddMyBirthData}>Добавить данные</button>
              </>
            ) : (
              <>
                <strong>{name} пока без данных рождения</strong>
                <p>Как только это случится, общий разбор появится у вас обоих сам.</p>
              </>
            )}
          </section>
        ) : failed && !reading ? (
          <section className="people-empty-card">
            <strong>Не получилось подготовить разбор</strong>
            <p>Так бывает при слабом интернете. Ничего не потерялось.</p>
            <button type="button" className="people-primary" onClick={() => void load(pair?.status === 'ready' || pair?.status === 'writing_failed')}>Попробовать ещё раз</button>
          </section>
        ) : pair ? (
          <>
            {gaugeScore != null ? <CompatibilityGauge score={gaugeScore} questions={gaugeQuestions} language="ru" /> : null}

            {pair.premiumFrom === 'partner' ? (
              <p className="people-gift-note"><Sparkles size={15} aria-hidden="true" />{giftNote(name, person.gender)}</p>
            ) : null}

            {writing ? (
              <section className="people-status" role="status">
                <span className="people-spinner" aria-hidden="true" />
                <span>Пишем ваш общий разбор. Он один на двоих, поэтому {name} увидит то же самое.</span>
              </section>
            ) : reading ? (
              <>
                {reading.summary ? <section className="compat-story-summary"><p>{reading.summary}</p></section> : null}
                <CompatibilityStoryReader result={reading} language="ru" subjectName={me.name} partnerName={name} />
              </>
            ) : preview ? (
              <>
                <CompatibilityAnswers
                  language="ru"
                  rows={preview.questions.map((question) => ({ ...question, text: question.explanation, locked: question.locked }))}
                  unknownHint="Чтобы ответить, нужно точное время рождения обоих."
                />
                {pair.status === 'locked' ? (
                  <section className="people-unlock">
                    <Lock size={16} aria-hidden="true" />
                    <div>
                      <strong>Полный разбор на двоих</strong>
                      <p>Одной подписки хватит вам обоим: если Premium есть у кого-то из вас, разбор откроется у двоих сразу.</p>
                    </div>
                    {canPromotePremium ? (
                      <button type="button" className="people-primary" onClick={() => { lumiaSelectionHaptic(); onRequestPremium(); }}>Открыть для нас двоих</button>
                    ) : null}
                  </section>
                ) : null}
              </>
            ) : null}

            {preview?.talkDays?.length ? (
              <CompatibilityTalkCalendar
                days={preview.talkDays}
                premium={pair.status === 'ready'}
                language="ru"
                onUnlock={canPromotePremium && pair.status === 'locked' ? onRequestPremium : undefined}
              />
            ) : null}
          </>
        ) : null}

        <section className="people-settings" aria-label="Настройки связи">
          <h2>Ваша связь</h2>
          <div className="people-setting">
            <span>
              <strong>Кто вы друг другу</strong>
              <small>{linkContextLabel(person.relationshipContext)}. Меняется, только если согласны оба.</small>
            </span>
            <button type="button" className="people-pill" onClick={() => { lumiaSelectionHaptic(); setEditingContext((value) => !value); }}>
              {editingContext ? 'Скрыть' : 'Изменить'}
            </button>
          </div>
          {editingContext ? (
            <div className="people-context-grid is-compact" role="radiogroup" aria-label="Кто вы друг другу">
              {LINK_CONTEXT_OPTIONS.map((option) => (
                <button
                  key={option.value}
                  type="button"
                  role="radio"
                  aria-checked={(person.proposedByMe ? person.proposedContext : person.relationshipContext) === option.value}
                  className={`people-context-tile${(person.proposedByMe ? person.proposedContext : person.relationshipContext) === option.value ? ' is-active' : ''}`}
                  disabled={busy}
                  onClick={() => pickContext(option.value)}
                >
                  <strong>{option.label}</strong>
                </button>
              ))}
            </div>
          ) : null}
          <label className="people-setting">
            <span>
              <strong>Показывать мой день рождения</strong>
              <small>{name} увидит число и месяц, без года</small>
            </span>
            <input
              type="checkbox"
              role="switch"
              checked={person.shareMyBirthday}
              disabled={busy}
              onChange={(event) => { lumiaSelectionHaptic(); const value = event.target.checked; void change(() => updatePerson(person.linkId, { shareBirthday: value })); }}
            />
          </label>
          <p className="people-privacy">Твоя натальная карта, личные прогнозы и вопросы {name} не видит.</p>
          {!confirmUnlink ? (
            <button type="button" className="people-text-button is-danger" onClick={() => { lumiaSelectionHaptic(); setConfirmUnlink(true); }}>Удалить связь</button>
          ) : (
            <div className="people-confirm">
              <p>Общий разбор пропадёт у вас обоих. Вернуть его можно только новым приглашением.</p>
              <div>
                <button type="button" className="people-pill is-danger" disabled={busy} onClick={() => void removeLink()}>Удалить</button>
                <button type="button" className="people-pill" onClick={() => setConfirmUnlink(false)}>Оставить</button>
              </div>
            </div>
          )}
        </section>
      </div>
    </dialog>
  );
}
