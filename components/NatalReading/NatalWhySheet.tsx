import React, { useMemo } from 'react';
import { ChevronDown } from 'lucide-react';
import type { NatalChartData, UserProfile } from '../../types';
import {
  buildNatalModelContext,
  getPermanentNatalReliability,
  type NatalEvidenceFact,
} from '../../lib/natalReading/permanentReport';
import { CosmicSheet } from '../lumia-ui/CosmicSheet';
import styles from '../../styles/NatalMeaningExperience.module.css';

type Props = {
  open: boolean;
  statement: string;
  evidenceIds: readonly string[];
  profile: UserProfile;
  chartData: NatalChartData;
  onClose: () => void;
};

const SIGN_RU: Record<string, string> = {
  Aries: 'Овен',
  Taurus: 'Телец',
  Gemini: 'Близнецы',
  Cancer: 'Рак',
  Leo: 'Лев',
  Virgo: 'Дева',
  Libra: 'Весы',
  Scorpio: 'Скорпион',
  Sagittarius: 'Стрелец',
  Capricorn: 'Козерог',
  Aquarius: 'Водолей',
  Pisces: 'Рыбы',
};

const OBJECT_LABELS: Record<string, { ru: string; en: string }> = {
  sun: { ru: 'Солнце', en: 'Sun' },
  moon: { ru: 'Луна', en: 'Moon' },
  mercury: { ru: 'Меркурий', en: 'Mercury' },
  venus: { ru: 'Венера', en: 'Venus' },
  mars: { ru: 'Марс', en: 'Mars' },
  jupiter: { ru: 'Юпитер', en: 'Jupiter' },
  saturn: { ru: 'Сатурн', en: 'Saturn' },
  uranus: { ru: 'Уран', en: 'Uranus' },
  neptune: { ru: 'Нептун', en: 'Neptune' },
  pluto: { ru: 'Плутон', en: 'Pluto' },
  chiron: { ru: 'Хирон', en: 'Chiron' },
  northnode: { ru: 'Северный узел', en: 'North Node' },
  southnode: { ru: 'Южный узел', en: 'South Node' },
  ascendant: { ru: 'Асцендент', en: 'Ascendant' },
  rising: { ru: 'Асцендент', en: 'Ascendant' },
  mc: { ru: 'MC', en: 'MC' },
  descendant: { ru: 'Десцендент', en: 'Descendant' },
  ic: { ru: 'IC', en: 'IC' },
};

const ASPECT_LABELS: Record<string, { ru: string; en: string }> = {
  conjunction: { ru: 'соединение', en: 'conjunction' },
  sextile: { ru: 'секстиль', en: 'sextile' },
  square: { ru: 'квадрат', en: 'square' },
  trine: { ru: 'трин', en: 'trine' },
  opposition: { ru: 'оппозиция', en: 'opposition' },
};

function normalizedObject(value: unknown): string {
  return String(value || '')
    .trim()
    .replace(/[\s_-]+/g, '')
    .toLocaleLowerCase('en-US');
}

function objectLabel(value: unknown, language: 'ru' | 'en'): string {
  const raw = String(value || '').trim();
  const normalized = normalizedObject(raw);
  return OBJECT_LABELS[normalized]?.[language]
    || raw
    || (language === 'ru' ? 'Часть карты' : 'Chart point');
}

function signLabel(value: unknown, language: 'ru' | 'en'): string {
  const raw = String(value || '').trim();
  if (!raw) return '';
  return language === 'ru' ? SIGN_RU[raw] || raw : raw;
}

function degreeLabel(value: unknown): string {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? `${Number(numeric.toFixed(2))}°` : '';
}

function houseLabel(value: unknown, language: 'ru' | 'en'): string {
  const numeric = Number(value);
  if (!Number.isFinite(numeric) || numeric < 1) return '';
  return language === 'ru' ? `${numeric} дом` : `house ${numeric}`;
}

function technicalFactLabel(fact: NatalEvidenceFact, language: 'ru' | 'en'): string {
  const data = fact.data || {};
  if (fact.kind === 'quality') {
    const quality = String(data.birthTimeQuality || 'unknown');
    if (language === 'ru') {
      if (quality === 'exact') return 'Время рождения указано точно';
      if (quality === 'approximate') return 'Время рождения указано примерно';
      return 'Время рождения не указано';
    }
    if (quality === 'exact') return 'Birth time is exact';
    if (quality === 'approximate') return 'Birth time is approximate';
    return 'Birth time is unknown';
  }

  if (fact.kind === 'placement' || fact.kind === 'angle') {
    const name = objectLabel(data.key || data.object || fact.object, language);
    const sign = signLabel(data.sign, language);
    const degree = degreeLabel(data.degree);
    const house = houseLabel(data.house, language);
    return [
      name,
      sign ? `${language === 'ru' ? 'в' : 'in'} ${sign}` : '',
      degree,
      house,
    ].filter(Boolean).join(' · ');
  }

  if (fact.kind === 'house') {
    const number = houseLabel(data.house || data.number, language);
    const sign = signLabel(data.sign, language);
    const degree = degreeLabel(data.degree);
    return [
      number || (language === 'ru' ? 'Дом' : 'House'),
      sign ? `${language === 'ru' ? 'начинается в' : 'starts in'} ${sign}` : '',
      degree,
    ].filter(Boolean).join(' · ');
  }

  if (fact.kind === 'aspect') {
    const from = objectLabel(data.fromKey || data.from || data.first || fact.object, language);
    const to = objectLabel(data.toKey || data.to || data.second, language);
    const type = String(data.type || '').trim().toLocaleLowerCase('en-US');
    const aspect = ASPECT_LABELS[type]?.[language] || type;
    const orb = degreeLabel(data.orb);
    return [from, aspect, to, orb].filter(Boolean).join(' · ');
  }

  return objectLabel(fact.object, language);
}

function plainCueForFact(fact: NatalEvidenceFact, language: 'ru' | 'en'): string | null {
  if (fact.kind === 'aspect') {
    return language === 'ru'
      ? 'как две сильные реакции работают вместе'
      : 'how two strong reactions work together';
  }
  if (fact.kind === 'house' || fact.kind === 'angle') {
    return language === 'ru'
      ? 'где это чаще становится заметно'
      : 'where this tends to show up most clearly';
  }

  const key = normalizedObject(fact.data?.key || fact.data?.object || fact.object);
  const cues: Record<string, { ru: string; en: string }> = {
    sun: { ru: 'как ты держишь свой курс', en: 'how you keep your direction' },
    moon: { ru: 'как ты реагируешь, когда задевает', en: 'how you react when something gets to you' },
    mercury: { ru: 'как ты думаешь и объясняешь', en: 'how you think and explain yourself' },
    venus: { ru: 'что нравится и что быстро отталкивает', en: 'what attracts you and what quickly puts you off' },
    mars: { ru: 'как ты действуешь и споришь', en: 'how you act and argue' },
    jupiter: { ru: 'где тебе легче брать больше', en: 'where it is easier for you to go bigger' },
    saturn: { ru: 'где ты включаешь осторожность', en: 'where caution takes over' },
    uranus: { ru: 'где тебе нужен свой способ', en: 'where you need your own way' },
    neptune: { ru: 'где легко додумать лишнее', en: 'where it is easy to read too much into things' },
    pluto: { ru: 'где тебе трудно уступить', en: 'where it is hard for you to give way' },
    chiron: { ru: 'что особенно легко задевает', en: 'what can hit a particularly sensitive spot' },
    northnode: { ru: 'куда тебя чаще тянет расти', en: 'where you are more often pulled to grow' },
    southnode: { ru: 'что ты делаешь почти автоматически', en: 'what you tend to do almost automatically' },
    ascendant: { ru: 'как ты входишь в новую ситуацию', en: 'how you enter a new situation' },
    rising: { ru: 'как ты входишь в новую ситуацию', en: 'how you enter a new situation' },
    mc: { ru: 'как ты выглядишь в работе и больших целях', en: 'how you come across in work and larger goals' },
  };
  return cues[key]?.[language] || null;
}

function unique(values: Array<string | null | undefined>): string[] {
  return [...new Set(values.filter((value): value is string => Boolean(value)))];
}

function plainReason(facts: readonly NatalEvidenceFact[], language: 'ru' | 'en'): string {
  const hasAspect = facts.some((fact) => fact.kind === 'aspect');
  const hasPlace = facts.some((fact) => fact.kind === 'placement');
  const hasWhere = facts.some((fact) => fact.kind === 'house' || fact.kind === 'angle');

  if (language === 'ru') {
    if (hasAspect && hasPlace && hasWhere) {
      return 'Этот вывод не взят из одной строчки. Здесь совпали твоя обычная реакция, то, как разные черты работают вместе, и место, где это чаще видно.';
    }
    if (hasAspect && hasPlace) {
      return 'Здесь совпали несколько частей карты. Одна показывает привычную реакцию, другая — что происходит, когда две сильные черты включаются одновременно.';
    }
    if (hasWhere) {
      return 'Время рождения добавило важную деталь: не только что у тебя повторяется, но и где это чаще становится заметно.';
    }
    if (facts.length > 1) {
      return 'Этот вывод собран из нескольких устойчивых частей карты. По одной они говорят мало; вместе дают уже узнаваемую картину.';
    }
    return 'Вывод опирается на одну из самых заметных частей карты и проверяется по тому, как она связана с остальными.';
  }

  if (hasAspect && hasPlace && hasWhere) {
    return 'This conclusion does not come from one line. It combines your usual reaction, how strong traits work together, and where that pattern tends to show up.';
  }
  if (hasAspect && hasPlace) {
    return 'Several parts of the chart point in the same direction: one shows the usual reaction, another shows what happens when two strong traits switch on together.';
  }
  if (hasWhere) {
    return 'The birth time adds an important detail: not only what repeats, but where it tends to become most visible.';
  }
  if (facts.length > 1) {
    return 'This conclusion combines several stable parts of the chart. Each says little on its own; together they form a recognisable pattern.';
  }
  return 'The conclusion rests on one of the chart’s clearest signals and is checked against the rest of the chart.';
}

function timeNote(
  facts: readonly NatalEvidenceFact[],
  quality: 'exact' | 'approximate' | 'unknown',
  language: 'ru' | 'en',
): { title: string; body: string } {
  const usesTimeSensitiveFact = facts.some((fact) => (
    fact.kind === 'house'
    || fact.kind === 'angle'
    || (fact.kind === 'placement' && Number.isFinite(Number(fact.data?.house)))
  ));

  if (language === 'ru') {
    if (quality === 'unknown') {
      return {
        title: 'Без догадок о времени',
        body: 'Время рождения не указано. Дома и Асцендент в этот вывод не входят.',
      };
    }
    if (quality === 'approximate') {
      return {
        title: 'Проверено в пределах указанного времени',
        body: usesTimeSensitiveFact
          ? 'Мы взяли только детали, которые не меняются внутри указанного диапазона.'
          : 'Этот вывод не держится на деталях, которые быстро меняются из-за времени рождения.',
      };
    }
    return {
      title: usesTimeSensitiveFact ? 'Здесь важно точное время' : 'Время почти не влияет на этот вывод',
      body: usesTimeSensitiveFact
        ? 'В расчёте использованы детали, которые меняются в течение дня. Поэтому точность времени рождения здесь действительно важна.'
        : 'Вывод собран без опоры на дома и Асцендент. Небольшая ошибка во времени его не перевернёт.',
    };
  }

  if (quality === 'unknown') {
    return {
      title: 'No guesswork about birth time',
      body: 'Birth time is unknown. Houses and the Ascendant are not used in this conclusion.',
    };
  }
  if (quality === 'approximate') {
    return {
      title: 'Checked across the time range',
      body: usesTimeSensitiveFact
        ? 'Only details that stay unchanged across the entered time range are used.'
        : 'This conclusion does not rely on details that shift quickly with birth time.',
    };
  }
  return {
    title: usesTimeSensitiveFact ? 'Exact time matters here' : 'Time barely changes this conclusion',
    body: usesTimeSensitiveFact
      ? 'The conclusion uses details that move during the day, so the recorded birth time matters.'
      : 'The conclusion does not rely on houses or the Ascendant. A small time error will not overturn it.',
  };
}

function shortSubtitle(statement: string): string {
  const compact = statement.replace(/\s+/g, ' ').trim();
  return compact.length > 88 ? `${compact.slice(0, 85).trimEnd()}…` : compact;
}

export const NatalWhySheet: React.FC<Props> = ({
  open,
  statement,
  evidenceIds,
  profile,
  chartData,
  onClose,
}) => {
  const language: 'ru' | 'en' = profile.language === 'en' ? 'en' : 'ru';
  const built = useMemo(
    () => buildNatalModelContext(profile, chartData),
    [chartData, profile],
  );
  const evidenceById = useMemo(
    () => new Map(built.context.evidence.map((fact) => [fact.id, fact])),
    [built],
  );
  const facts = useMemo(
    () => evidenceIds
      .map((id) => evidenceById.get(id))
      .filter((fact): fact is NatalEvidenceFact => Boolean(fact)),
    [evidenceById, evidenceIds],
  );
  const cues = useMemo(
    () => unique(facts.map((fact) => plainCueForFact(fact, language))).slice(0, 5),
    [facts, language],
  );
  const reliability = getPermanentNatalReliability(chartData);
  const timing = timeNote(facts, reliability.quality, language);

  return (
    <CosmicSheet
      open={open}
      title={language === 'ru' ? 'Почему так?' : 'Why this conclusion?'}
      subtitle={shortSubtitle(statement)}
      closeLabel={language === 'ru' ? 'Закрыть' : 'Close'}
      onClose={onClose}
      className={`lz-sheet-panel--editorial ${styles.whySheet}`}
      contentClassName={`lz-sheet-scroll--editorial ${styles.whySheetContent}`}
    >
      <section className={styles.whyBlock}>
        <h3>{language === 'ru' ? 'Простыми словами' : 'In plain language'}</h3>
        <p>{plainReason(facts, language)}</p>
      </section>

      {cues.length ? (
        <section className={styles.whyBlock}>
          <h3>{language === 'ru' ? 'Что мы проверили' : 'What we checked'}</h3>
          <ul className={styles.whyPlainList}>
            {cues.map((cue) => <li key={cue}>{cue}</li>)}
          </ul>
        </section>
      ) : null}

      <section className={styles.timeNote}>
        <strong>{timing.title}</strong>
        <span>{timing.body}</span>
      </section>

      <details className={styles.whyTechnical}>
        <summary>
          <span>{language === 'ru' ? 'Показать данные карты' : 'Show chart data'}</span>
          <ChevronDown aria-hidden="true" />
        </summary>
        <ul className={styles.whyTechnicalList}>
          {facts.length ? facts.map((fact) => (
            <li key={fact.id}>{technicalFactLabel(fact, language)}</li>
          )) : (
            <li>
              {language === 'ru'
                ? 'Вывод собран из общего набора надёжных данных карты.'
                : 'The conclusion uses the chart’s overall set of reliable data.'}
            </li>
          )}
        </ul>
      </details>
    </CosmicSheet>
  );
};
