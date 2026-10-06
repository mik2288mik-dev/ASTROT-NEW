import React from 'react';
import { Check, Lock, X } from 'lucide-react';
import type { RelationshipContext } from '../lib/synastry/relationshipContext';
import type { PairTalkDay } from '../lib/synastry/pairTalkCalendar';
import { gaugeArc, gaugePoint, gaugePosition } from './CompatibilityAnswers';

type Topic = Exclude<RelationshipContext, 'ex'>;

const TOPIC_LABELS: Record<Topic, { label: [string, string]; where: [string, string] }> = {
  romance: { label: ['любовь', 'love'], where: ['в любви', 'in love'] },
  relationship: { label: ['пара', 'couple'], where: ['в отношениях', 'as a couple'] },
  friendship: { label: ['дружба', 'friends'], where: ['в дружбе', 'as friends'] },
  family: { label: ['семья', 'family'], where: ['в семье', 'as family'] },
  work: { label: ['работа', 'work'], where: ['в работе', 'at work'] },
};

function MiniGauge({ score }: { score: number }) {
  const [x, y] = gaugePoint(gaugePosition(score), 30, 40, 40);
  return (
    <svg viewBox="0 0 80 46" className="compat-topic-dial" aria-hidden="true">
      <path d={gaugeArc(0, 0.32, 30, 40, 40)} className="compat-gauge-zone is-hard" />
      <path d={gaugeArc(0.35, 0.65, 30, 40, 40)} className="compat-gauge-zone is-mixed" />
      <path d={gaugeArc(0.68, 1, 30, 40, 40)} className="compat-gauge-zone is-easy" />
      <line x1="40" y1="40" x2={x.toFixed(2)} y2={y.toFixed(2)} className="compat-gauge-needle" />
      <circle cx="40" cy="40" r="3" className="compat-gauge-hub" />
    </svg>
  );
}

/** The same pair across every relationship type; tapping a type switches the reading. */
export function CompatibilityTopicSwitch({ topics, active, onPick, language }: {
  topics: Array<{ context: Topic; overallScore: number }>;
  active: RelationshipContext;
  onPick: (context: Topic) => void;
  language: 'ru' | 'en';
}) {
  if (topics.length < 2) return null;
  const ru = language === 'ru';
  const index = ru ? 0 : 1;
  const sorted = [...topics].sort((first, second) => second.overallScore - first.overallScore);
  const best = sorted[0];
  const worst = sorted[sorted.length - 1];
  const headline = best.overallScore - worst.overallScore < 4
    ? (ru ? 'Во всех темах у вас примерно одинаково' : 'You are about the same in every area')
    : ru
      ? `Легче всего вам ${TOPIC_LABELS[best.context].where[0]}, труднее всего, ${TOPIC_LABELS[worst.context].where[0]}`
      : `Easiest ${TOPIC_LABELS[best.context].where[1]}, hardest ${TOPIC_LABELS[worst.context].where[1]}`;
  return (
    <section className="compat-topics" aria-label={ru ? 'Совместимость по темам' : 'Compatibility by area'}>
      <p className="compat-topics-headline">{headline}</p>
      <div className="compat-topics-row" role="group">
        {topics.map((topic) => (
          <button
            key={topic.context}
            type="button"
            className={`compat-topic${topic.context === active ? ' is-active' : ''}`}
            aria-pressed={topic.context === active}
            onClick={() => { if (topic.context !== active) onPick(topic.context); }}
          >
            <MiniGauge score={topic.overallScore} />
            <span>{TOPIC_LABELS[topic.context].label[index]}</span>
          </button>
        ))}
      </div>
    </section>
  );
}

const FREE_TALK_DAYS = 7;

/** «Когда лучше поговорить»: the next days for an important talk between the two. */
export function CompatibilityTalkCalendar({ days, premium, language, onUnlock }: {
  days: PairTalkDay[];
  premium: boolean;
  language: 'ru' | 'en';
  onUnlock?: () => void;
}) {
  if (!days.length) return null;
  const ru = language === 'ru';
  const locale = ru ? 'ru-RU' : 'en-US';
  const visible = premium ? days : days.slice(0, FREE_TALK_DAYS);
  const hidden = days.length - visible.length;
  const dateOf = (key: string) => new Date(`${key}T12:00:00Z`);
  const longDate = (key: string) => dateOf(key).toLocaleDateString(locale, { day: 'numeric', month: 'long', timeZone: 'UTC' });
  const nextGood = visible.find((day) => day.tone === 'good');
  const nextHard = visible.find((day) => day.tone === 'hard');
  return (
    <section className="compat-talk" aria-label={ru ? 'Когда лучше поговорить' : 'When to talk'}>
      <h3>{ru ? 'Когда лучше поговорить' : 'When to talk'}</h3>
      <p className="compat-talk-lead">
        {ru
          ? 'Дни, когда вам проще обсуждать важное, и дни, когда лучше не выяснять отношения.'
          : 'Days when important talks go easier, and days better left without arguments.'}
      </p>
      <div className="compat-talk-grid">
        {visible.map((day) => (
          <div key={day.date} className={`compat-talk-day is-${day.tone}`} title={day.reason || undefined}>
            <small>{dateOf(day.date).toLocaleDateString(locale, { weekday: 'short', timeZone: 'UTC' })}</small>
            <strong>{dateOf(day.date).getUTCDate()}</strong>
            {day.tone === 'good' ? <Check size={12} strokeWidth={2.2} aria-label={ru ? 'хороший день' : 'good day'} /> : null}
            {day.tone === 'hard' ? <X size={12} strokeWidth={2.2} aria-label={ru ? 'трудный день' : 'hard day'} /> : null}
          </div>
        ))}
      </div>
      <ul className="compat-talk-notes">
        {nextGood ? <li><Check size={14} strokeWidth={2.2} aria-hidden="true" /><span><strong>{longDate(nextGood.date)}</strong>, {nextGood.reason}</span></li> : null}
        {nextHard ? <li><X size={14} strokeWidth={2.2} aria-hidden="true" /><span><strong>{longDate(nextHard.date)}</strong>, {nextHard.reason}</span></li> : null}
        {!nextGood && !nextHard ? <li><span>{ru ? 'Ближайшие дни ровные: особых плюсов и минусов для разговоров нет.' : 'The coming days are even: nothing special for or against talks.'}</span></li> : null}
      </ul>
      {hidden > 0 ? (
        <button type="button" className="compat-talk-more" onClick={onUnlock}>
          <Lock size={14} strokeWidth={1.8} aria-hidden="true" />
          {ru ? `Ещё ${hidden} дней, в полном разборе` : `${hidden} more days in the full reading`}
        </button>
      ) : null}
    </section>
  );
}
