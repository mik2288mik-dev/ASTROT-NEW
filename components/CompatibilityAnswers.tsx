import React from 'react';
import { Lock } from 'lucide-react';

export type CompatibilityAnswerRow = {
  id: string;
  question: string;
  score: number | null;
  answer: 'yes' | 'likely' | 'mixed' | 'hard' | 'unknown';
  answerLabel: string;
  text?: string | null;
  locked?: boolean;
};

type Props = {
  rows: CompatibilityAnswerRow[];
  language: 'ru' | 'en';
  /** Shown under a question the charts cannot answer, e.g. a hint to add a birth time. */
  unknownHint?: string;
};

/** Questions of the chosen relationship type with the calculated short answer and its explanation. */
export function CompatibilityAnswers({ rows, language, unknownHint }: Props) {
  const ru = language === 'ru';
  return (
    <div className="compat-answers" aria-label={ru ? 'Ответы на вопросы' : 'Answers'}>
      {rows.map((row) => (
        <section key={row.id} className={`compat-answer compat-answer--${row.answer}`} aria-labelledby={`compat-answer-${row.id}`}>
          <header className="compat-answer-head">
            <h3 id={`compat-answer-${row.id}`}>{row.question}</h3>
            <span className="compat-answer-tag">{row.answerLabel}</span>
          </header>
          {row.score != null ? (
            <span
              className="compat-answer-bar"
              role="img"
              aria-label={ru ? `${row.score} из 100` : `${row.score} out of 100`}
              style={{ '--compat-answer-score': `${row.score}%` } as React.CSSProperties}
            />
          ) : null}
          {row.text ? <p>{row.text}</p> : null}
          {!row.text && row.locked ? (
            <p className="compat-answer-locked">
              <Lock size={14} strokeWidth={1.8} aria-hidden="true" />
              {ru ? 'Почему так и что делать — в полном разборе' : 'Why, and what to do — in the full reading'}
            </p>
          ) : null}
          {row.answer === 'unknown' && unknownHint ? <p className="compat-answer-hint">{unknownHint}</p> : null}
        </section>
      ))}
    </div>
  );
}

type GaugeQuestion = { score: number | null; short?: string; question: string };

/**
 * The needle moves through three equal zones that follow the answer bands:
 * below 48 «трудно», 48–61 «по-разному», 62 and above «легко».
 */
export function gaugePosition(score: number): number {
  const clamped = Math.max(0, Math.min(100, score));
  if (clamped < 48) return (clamped / 48) / 3;
  if (clamped < 62) return 1 / 3 + ((clamped - 48) / 14) / 3;
  return 2 / 3 + ((clamped - 62) / 38) / 3;
}

export function gaugeHeadline(score: number, ru: boolean): string {
  if (score >= 62) return ru ? 'Вам легко друг с другом' : 'You find it easy together';
  if (score >= 55) return ru ? 'Чаще легко, чем трудно' : 'More often easy than hard';
  if (score >= 48) return ru ? 'Поровну лёгкого и трудного' : 'Equal parts easy and hard';
  if (score >= 35) return ru ? 'Чаще трудно, чем легко' : 'More often hard than easy';
  return ru ? 'Вместе будет непросто' : 'It will not be easy together';
}

export const gaugePoint = (fraction: number, radius: number, cx = 100, cy = 100) => {
  const angle = Math.PI * (1 - fraction);
  return [cx + radius * Math.cos(angle), cy - radius * Math.sin(angle)] as const;
};

export const gaugeArc = (from: number, to: number, radius = 80, cx = 100, cy = 100) => {
  const [x1, y1] = gaugePoint(from, radius, cx, cy);
  const [x2, y2] = gaugePoint(to, radius, cx, cy);
  return `M${x1.toFixed(2)} ${y1.toFixed(2)} A${radius} ${radius} 0 0 1 ${x2.toFixed(2)} ${y2.toFixed(2)}`;
};

/** Overall result as a plain gauge: no numbers on top, they live in «Как мы считали». */
export function CompatibilityGauge({ score, questions, language }: { score: number; questions: GaugeQuestion[]; language: 'ru' | 'en' }) {
  const ru = language === 'ru';
  const [needleX, needleY] = gaugePoint(gaugePosition(score), 76);
  const answered = questions.filter((item) => item.score != null && item.short);
  const sorted = [...answered].sort((first, second) => second.score! - first.score!);
  const strongest = sorted[0];
  const hardest = sorted.length > 1 ? sorted[sorted.length - 1] : undefined;
  const capital = (value: string) => value.charAt(0).toUpperCase() + value.slice(1);
  const headline = gaugeHeadline(score, ru);
  return (
    <section className="compat-gauge" aria-label={ru ? `Общий результат: ${headline}` : `Overall result: ${headline}`}>
      <svg viewBox="0 0 200 122" className="compat-gauge-dial" aria-hidden="true">
        <path d={gaugeArc(0, 0.325)} className="compat-gauge-zone is-hard" />
        <path d={gaugeArc(0.342, 0.658)} className="compat-gauge-zone is-mixed" />
        <path d={gaugeArc(0.675, 1)} className="compat-gauge-zone is-easy" />
        <line x1="100" y1="100" x2={needleX.toFixed(2)} y2={needleY.toFixed(2)} className="compat-gauge-needle" />
        <circle cx="100" cy="100" r="6" className="compat-gauge-hub" />
        <text x="20" y="119" textAnchor="middle">{ru ? 'трудно' : 'hard'}</text>
        <text x="100" y="119" textAnchor="middle">{ru ? 'по-разному' : 'it varies'}</text>
        <text x="180" y="119" textAnchor="middle">{ru ? 'легко' : 'easy'}</text>
      </svg>
      <h2>{headline}</h2>
      {strongest && hardest && strongest !== hardest ? (
        <p>
          {ru
            ? `Сильнее всего — ${strongest.short}. Труднее всего — ${hardest.short}.`
            : `${capital(strongest.short!)} is your strongest side, ${hardest.short} the hardest.`}
        </p>
      ) : null}
    </section>
  );
}

/** The numbers behind the gauge and the answers, kept at the bottom for those who want them. */
export function CompatibilityCalculation({ score, questions, limitations, language }: {
  score: number;
  questions: GaugeQuestion[];
  limitations?: string[];
  language: 'ru' | 'en';
}) {
  const ru = language === 'ru';
  return (
    <details className="compat-calculation">
      <summary>{ru ? 'Как мы считали' : 'How we calculated'}</summary>
      <p>
        {ru
          ? 'Сравнили положения планет в двух картах и посчитали, сколько связей между ними помогают, а сколько мешают. Общий индекс:'
          : 'We compared planet positions in the two charts and counted how many links between them help and how many get in the way. Overall index:'}
        {' '}<strong>{score} {ru ? 'из 100' : 'out of 100'}</strong>
      </p>
      <ul>
        {questions.map((item) => (
          <li key={item.question}>
            <span>{item.question}</span>
            <strong>{item.score != null ? item.score : (ru ? 'мало данных' : 'not enough data')}</strong>
          </li>
        ))}
      </ul>
      {limitations?.length ? <p className="compat-calculation-note">{limitations.join(' ')}</p> : null}
    </details>
  );
}
