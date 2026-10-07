import React, { useEffect, useMemo, useState } from 'react';
import { ChevronRight, Gift, Lock } from 'lucide-react';
import type { ChartListItem } from '../../services/storageService';
import { loadExploreCharts, peekExploreCharts } from '../PersonalForecastFeed/exploreCharts';
import { loadFeatureState, peekFeatureState, saveFeatureState } from '../../services/featureStateService';
import { buildPairFacts } from '../../lib/peoplePairFacts';
import { daysBetweenKeys, nextBirthdayKey } from '../../lib/forYou';
import { CosmicSheet } from '../lumia-ui/CosmicSheet';
import type { GiftPerson } from './GiftIdeasSheet';

type PeopleSettings = { hidden: string[]; facts: boolean; birthdays: boolean };

const SIGN_NOM_RU: Record<string, string> = {
  aries: 'Овен', taurus: 'Телец', gemini: 'Близнецы', cancer: 'Рак', leo: 'Лев', virgo: 'Дева',
  libra: 'Весы', scorpio: 'Скорпион', sagittarius: 'Стрелец', capricorn: 'Козерог', aquarius: 'Водолей', pisces: 'Рыбы',
};
const TONES = [['#fde6d9', '#c4512e'], ['#e7effb', '#2d6fd6'], ['#e7f6ee', '#2a7a45'], ['#f1edff', '#6b4fc8']] as const;

function pluralDays(count: number): string {
  const mod10 = count % 10;
  const mod100 = count % 100;
  if (mod10 === 1 && mod100 !== 11) return 'день';
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) return 'дня';
  return 'дней';
}

function firstName(name: string): string {
  return name.trim().split(/\s+/u)[0] || name;
}

function signRu(sign: string | null | undefined): string | null {
  return sign ? SIGN_NOM_RU[sign.trim().toLowerCase()] ?? null : null;
}

function readSettings(value: unknown): PeopleSettings {
  const record = value as Partial<PeopleSettings> | null;
  return {
    hidden: Array.isArray(record?.hidden) ? record!.hidden.map(String) : [],
    facts: record?.facts !== false,
    birthdays: record?.birthdays !== false,
  };
}

type PeopleBlockProps = {
  userId: string;
  todayKey: string;
  premium: boolean;
  onOpenPair?: (chartId: string, name: string) => void;
  onAddPerson?: () => void;
  onGift: (person: GiftPerson) => void;
};

/** «Ты и твои люди»: real contacts between your chart and your saved people, their birthdays and gift ideas. */
export function PeopleBlock({ userId, todayKey, premium, onOpenPair, onAddPerson, onGift }: PeopleBlockProps) {
  const [charts, setCharts] = useState<ChartListItem[] | null>(() => peekExploreCharts(userId));
  const [settings, setSettings] = useState<PeopleSettings>(() => readSettings(peekFeatureState(userId, 'home_people').settings));
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [tuning, setTuning] = useState(false);

  useEffect(() => {
    let active = true;
    void loadExploreCharts(userId).then((list) => { if (active) setCharts(list); });
    void loadFeatureState(userId, 'home_people').then((items) => { if (active) setSettings(readSettings(items.settings)); });
    return () => { active = false; };
  }, [userId]);

  const self = charts?.find((chart) => chart.is_primary) ?? null;
  const people = useMemo(() => (charts ?? [])
    .filter((chart) => !chart.is_primary && !chart.archived_at && chart.subject_type !== 'self' && chart.name?.trim()), [charts]);
  const visible = people.filter((chart) => !settings.hidden.includes(String(chart.id)));
  const selected = visible.find((chart) => String(chart.id) === selectedId) ?? visible[0] ?? null;
  const facts = useMemo(
    () => (settings.facts && self && selected ? buildPairFacts(self.chart_data, selected.chart_data, 2, todayKey) : []),
    [self, selected, settings.facts, todayKey],
  );

  const save = (next: PeopleSettings) => {
    setSettings(next);
    void saveFeatureState(userId, 'home_people', 'settings', next);
  };

  if (!charts) return null;

  const birthday = selected?.birth_date ? nextBirthdayKey(selected.birth_date, todayKey) : null;
  const daysLeft = birthday ? daysBetweenKeys(todayKey, birthday) : null;
  const name = selected ? firstName(selected.name) : '';

  return (
    <section className="people-block" aria-labelledby="people-block-title">
      <div className="people-block-heading">
        <h2 id="people-block-title" className="today-explore-heading">Ты и твои люди</h2>
        {people.length ? <button type="button" className="people-block-tune" onClick={() => setTuning(true)}>Настроить</button> : null}
      </div>

      {!visible.length ? (
        <div className="people-block-empty">
          <span>{people.length ? 'Все люди скрыты, включи, кого показывать.' : 'Добавь близких, покажем, что вас связывает, и напомним о днях рождения.'}</span>
          <button type="button" onClick={people.length ? () => setTuning(true) : onAddPerson}>{people.length ? 'Показать' : 'Добавить'}</button>
        </div>
      ) : (
        <div className="people-block-card">
          <div className="people-block-row" role="tablist" aria-label="Твои люди">
            {visible.map((person, index) => {
              const [bg, fg] = TONES[index % TONES.length];
              const active = person === selected;
              return (
                <button
                  key={person.id}
                  type="button"
                  role="tab"
                  aria-selected={active}
                  className={`people-chip${active ? ' is-active' : ''}`}
                  style={{ background: bg, color: fg }}
                  onClick={() => setSelectedId(String(person.id))}
                >
                  {firstName(person.name).charAt(0).toUpperCase()}
                  <i>{firstName(person.name)}</i>
                </button>
              );
            })}
            {onAddPerson ? (
              <button type="button" className="people-chip is-add" onClick={onAddPerson} aria-label="Добавить человека">+<i>добавить</i></button>
            ) : null}
          </div>

          {selected ? (
            <>
              <p className="people-block-kicker">
                Ты и {name}{signRu(selected.chart_data?.sun?.sign) ? ` · ${signRu(selected.chart_data?.sun?.sign)}` : ''} · по вашим картам
              </p>
              {facts.map((fact) => (
                <div key={fact.title} className="people-fact">
                  <b>{fact.title}</b>
                  <span>{fact.text}</span>
                </div>
              ))}
              {onOpenPair ? (
                <button type="button" className="people-fact is-locked" onClick={() => onOpenPair(String(selected.id), name)}>
                  <b>Где вы задеваете друг друга</b>
                  <span>И что с этим делать, в полном разборе пары</span>
                  {!premium ? <em><Lock size={11} aria-hidden="true" /> Premium</em> : <ChevronRight size={16} aria-hidden="true" />}
                </button>
              ) : null}
              <button
                type="button"
                className="people-gift"
                onClick={() => onGift({ name, chart: selected.chart_data ?? null, relation: selected.relation_label ?? null })}
              >
                <Gift size={16} aria-hidden="true" />
                <span>
                  {settings.birthdays && daysLeft !== null
                    ? (daysLeft === 0 ? 'День рождения сегодня' : `День рождения через ${daysLeft} ${pluralDays(daysLeft)}`)
                    : 'Подарок к случаю'}
                  {' · '}<b>что подарить?</b>
                </span>
                <ChevronRight size={16} aria-hidden="true" />
              </button>
              <div className="people-block-actions">
                {onOpenPair ? <button type="button" className="people-btn" onClick={() => onOpenPair(String(selected.id), name)}>Весь разбор пары</button> : null}
                {onAddPerson ? <button type="button" className="people-btn is-light" onClick={onAddPerson}>+ Добавить человека</button> : null}
              </div>
            </>
          ) : null}
        </div>
      )}

      <CosmicSheet
        open={tuning}
        title="Ты и твои люди"
        subtitle="Кого показывать на главной и что о них рассказывать"
        onClose={() => setTuning(false)}
        closeLabel="Закрыть"
      >
        <div className="people-tune">
          {people.map((person) => {
            const id = String(person.id);
            const shown = !settings.hidden.includes(id);
            return (
              <label key={id} className="people-tune-row">
                <span>{person.name}{signRu(person.chart_data?.sun?.sign) ? <small> · {signRu(person.chart_data?.sun?.sign)}</small> : null}</span>
                <input
                  type="checkbox"
                  role="switch"
                  checked={shown}
                  onChange={() => save({ ...settings, hidden: shown ? [...settings.hidden, id] : settings.hidden.filter((item) => item !== id) })}
                />
              </label>
            );
          })}
          <p className="people-tune-label">Что показывать</p>
          <label className="people-tune-row">
            <span>Совпадения по картам</span>
            <input type="checkbox" role="switch" checked={settings.facts} onChange={() => save({ ...settings, facts: !settings.facts })} />
          </label>
          <label className="people-tune-row">
            <span>Дни рождения</span>
            <input type="checkbox" role="switch" checked={settings.birthdays} onChange={() => save({ ...settings, birthdays: !settings.birthdays })} />
          </label>
        </div>
      </CosmicSheet>
    </section>
  );
}

