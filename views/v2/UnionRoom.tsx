import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import {
  CalendarDays,
  ChevronDown,
  Clock3,
  Info,
  MapPin,
  UserRound,
} from 'lucide-react';
import type { BirthTimeQuality, NatalChartData, SynastryResult, UserProfile } from '../../types';
import type { SignCompatibilityResult } from '../../lib/synastry/signCompatibility';
import { getZodiacSign } from '../../constants';
import { hasActivePremium } from '../../lib/accessMatrix';
import { getCharts, type ChartListItem } from '../../services/storageService';
import { getSignCompatibility, calculateExtendedSynastry } from '../../services/astrologyService';
import { formatDisplayDate, toDateInputValue } from '../../lib/date-utils';
import { lumiaSelectionHaptic } from '../../lib/haptics';
import { getCompatScore, sunSignFromDate, DIMENSION_LABELS, type CompatResult, type CompatDimension } from '../../lib/synastry/compatScore';
import { ZodiacIcon } from '../../components/icons/ZodiacIcon';
import { ZodiacSymbol } from '../../components/icons/ZodiacArt';
import { ChevronRightIcon } from '../../components/icons/UiIcons';
import { ZODIAC_KEYS } from '../../lib/zodiacKeys';
import { shareToTelegram } from '../../lib/botLink';
import { ContentActivityBar } from '../../components/Horoscope/HoroscopeActivityBar';
import { MeouLogo } from '../../components/onboarding/MeouLogo';
import { loadCompatHistory, addCompatHistory, removeCompatHistory, clearCompatHistory, buildCompatHistoryId, type CompatHistoryEntry } from '../../lib/compatHistory';
import { AppTopBar } from '../../components/lumia-ui/AppTopBar';
import type { CompatGender } from '../../lib/synastry/localSignText';
import {
  getRelationshipContextLabel,
  getRelationshipContextOption,
  normalizeRelationshipContext,
  type RelationshipContext,
} from '../../lib/synastry/relationshipContext';
import {
  EditorialProse,
  EditorialSectionHeading,
} from '../../components/EditorialReading';
import {
  classifyCompatibilityPerson,
  resolveCompatibilityPairLevel,
  type CompatibilityPairLevel,
} from '../../lib/synastry/compatibilityInput';
import type { PaywallContext } from '../../lib/paywallContext';
import {
  EditorialChartsButton,
  EditorialTabs,
} from '../../components/editorial/EditorialScreenChrome';
import { getCompatibilityRingGeometry } from '../../lib/synastry/compatibilityPresentation';
import { buildSignCompatibilityReactionKey } from '../../lib/synastry/compatibilityReaction';

type CompatibilityPersonSource = 'birth' | 'saved' | 'sign';

type SynastryPrefill = {
  source: 'saved-chart' | 'manual';
  partnerChartId?: number;
  partnerName?: string;
  partnerDate?: string;
  partnerTime?: string;
  partnerPlace?: string;
} | null;

type UnionRoomProps = {
  profile: UserProfile;
  chartData?: NatalChartData | null;
  chartId?: number | null;
  requestPremium: (source?: string, payload?: Record<string, unknown>) => void | Promise<void>;
  initialPrefill?: SynastryPrefill;
  onOpenCharts?: () => void;
  onCreateNatalChart?: () => void;
  onUpdateProfile?: (profile: UserProfile) => void;
  premiumContinuation?: PaywallContext | null;
  onPremiumContinuationHandled?: (paywallInstanceId: string) => void;
  canPromotePremium?: boolean;
  onOpenEncyclopedia?: () => void;
  uiPreview?: {
    screen: 'input' | 'signs' | 'result';
    resultState?: 'loading' | 'error';
    resultKind?: 'person' | 'sign';
    subject: {
      name: string;
      date: string;
      time: string;
      place: string;
      sign: string;
    };
    partner: {
      name: string;
      date: string;
      time: string;
      place: string;
      sign: string;
    };
    signCompatibility: SignCompatibilityResult;
    deepResult: SynastryResult;
  };
};

type CompatibilityTab = 'birth' | 'sign';
type CompatibilityFocus = 'love' | 'relationships' | 'friendship' | 'family' | 'work';

const COMPATIBILITY_FOCUS_OPTIONS: readonly {
  value: CompatibilityFocus;
  context: RelationshipContext;
  label: { ru: string; en: string };
}[] = [
  { value: 'love', context: 'romance', label: { ru: 'Любовь', en: 'Love' } },
  { value: 'relationships', context: 'relationship', label: { ru: 'Отношения', en: 'Relationship' } },
  { value: 'friendship', context: 'friendship', label: { ru: 'Дружба', en: 'Friendship' } },
  { value: 'family', context: 'family', label: { ru: 'Семья', en: 'Family' } },
  { value: 'work', context: 'work', label: { ru: 'Работа / бизнес', en: 'Work / business' } },
] as const;

function compatibilityFocusForContext(context: RelationshipContext): CompatibilityFocus {
  if (context === 'relationship') return 'relationships';
  if (context === 'friendship') return 'friendship';
  if (context === 'family') return 'family';
  if (context === 'work') return 'work';
  return 'love';
}

type Selected = {
  kind: 'sign' | 'person';
  relationshipContext: RelationshipContext;
  youSign: string;
  youGender: CompatGender;
  themGender: CompatGender;
  subjectChartId?: number;
  subjectName?: string;
  subjectDate?: string;
  subjectTime?: string;
  subjectBirthTimeQuality?: BirthTimeQuality;
  subjectPlace?: string;
  subjectSource?: CompatibilityPersonSource;
  subjectSign?: string;
  sign?: string;
  name?: string;
  date?: string;
  time?: string;
  partnerBirthTimeQuality?: BirthTimeQuality;
  place?: string;
  chartId?: number;
  partnerSource?: CompatibilityPersonSource;
  partnerSign?: string;
  calculationLevel?: CompatibilityPairLevel;
};

/* Переключатель пола М/Ж — две кнопки, без эмодзи. */
function GenderToggle({ value, onChange, ru, compact = false, labelledBy }: { value: CompatGender; onChange: (g: CompatGender) => void; ru: boolean; compact?: boolean; labelledBy?: string }) {
  return (
    <div
      className={`compat-choice-tabs compat-gender${compact ? ' is-compact' : ''}`}
      role="group"
      aria-label={labelledBy ? undefined : (ru ? 'Пол' : 'Gender')}
      aria-labelledby={labelledBy}
    >
      <button type="button" className={`compat-choice-tab compat-gender-btn ${value === 'male' ? 'is-on is-active' : ''}`} aria-pressed={value === 'male'} onClick={() => { lumiaSelectionHaptic(); onChange('male'); }}>
        {compact ? (ru ? 'М' : 'M') : (ru ? 'Мужчина' : 'Male')}
      </button>
      <button type="button" className={`compat-choice-tab compat-gender-btn ${value === 'female' ? 'is-on is-active' : ''}`} aria-pressed={value === 'female'} onClick={() => { lumiaSelectionHaptic(); onChange('female'); }}>
        {compact ? (ru ? 'Ж' : 'F') : (ru ? 'Женщина' : 'Female')}
      </button>
    </div>
  );
}

function PersonSourcePicker({
  value,
  onChange,
  ru,
}: {
  value: CompatibilityPersonSource;
  onChange: (value: CompatibilityPersonSource) => void;
  ru: boolean;
}) {
  const options: Array<{ value: CompatibilityPersonSource; label: string; description: string }> = [
    {
      value: 'saved',
      label: ru ? 'Карта' : 'Chart',
      description: ru ? 'Сравнение по карте рождения' : 'Compare by birth chart',
    },
    {
      value: 'birth',
      label: ru ? 'Дата' : 'Date',
      description: ru ? 'Сравнение по дате рождения' : 'Compare by birth date',
    },
    {
      value: 'sign',
      label: ru ? 'Знак' : 'Sign',
      description: ru ? 'Сравнение по знакам зодиака' : 'Compare by zodiac signs',
    },
  ];

  return (
    <div className="compat-person-source" role="group" aria-label={ru ? 'Способ сравнения' : 'Comparison method'}>
      {options.map((option) => {
        const active = option.value === value;
        return (
          <button
            key={option.value}
            type="button"
            className={`compat-person-source-option${active ? ' is-active' : ''}`}
            aria-pressed={active}
            aria-label={option.description}
            onClick={() => {
              lumiaSelectionHaptic();
              onChange(option.value);
            }}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}

function PersonBirthFields({
  prefix,
  ru,
  name,
  date,
  time,
  place,
  gender,
  timePrecision,
  onNameChange,
  onDateChange,
  onTimeChange,
  onPlaceChange,
  onGenderChange,
  onTimePrecisionChange,
}: {
  prefix: string;
  ru: boolean;
  name: string;
  date: string;
  time: string;
  place: string;
  gender: CompatGender;
  timePrecision: BirthTimeQuality;
  onNameChange: (value: string) => void;
  onDateChange: (value: string) => void;
  onTimeChange: (value: string) => void;
  onPlaceChange: (value: string) => void;
  onGenderChange: (value: CompatGender) => void;
  onTimePrecisionChange: (value: BirthTimeQuality) => void;
}) {
  const genderLabelId = `${prefix}-gender-label`;
  const timePrecisionLabelId = `${prefix}-time-precision-label`;
  const timePrecisionOptions: readonly { value: BirthTimeQuality; label: string }[] = [
    { value: 'exact', label: ru ? 'Знаю' : 'Exact' },
    { value: 'approximate', label: ru ? 'Примерно' : 'Approximate' },
    { value: 'unknown', label: ru ? 'Не знаю' : 'Unknown' },
  ];
  return (
    <div className="compat-air-fields">
      <label className="compat-air-field compat-air-field--name" htmlFor={`${prefix}-name`}>
        <span className="compat-air-label">{ru ? 'Имя' : 'Name'}</span>
        <span className="compat-air-control">
          <UserRound aria-hidden="true" size={20} strokeWidth={1.8} />
          <input name={`${prefix}-name`} id={`${prefix}-name`} className="compat-air-input" value={name} onChange={(event) => onNameChange(event.target.value)} placeholder={ru ? 'Имя человека' : 'Person name'} autoComplete="name" />
        </span>
      </label>

      <div className="compat-air-birth-row">
        <label className="compat-air-field" htmlFor={`${prefix}-date`}>
          <span className="compat-air-label">{ru ? 'Дата рождения' : 'Birth date'}</span>
          <span className="compat-air-control">
            <CalendarDays aria-hidden="true" size={20} strokeWidth={1.8} />
            <input name={`${prefix}-date`} id={`${prefix}-date`} className="compat-air-input" type="date" value={date} onChange={(event) => onDateChange(event.target.value)} />
          </span>
        </label>
        <label className="compat-air-field" htmlFor={`${prefix}-time`}>
          <span className="compat-air-label">{ru ? 'Время рождения' : 'Birth time'}</span>
          <span className="compat-air-control">
            <Clock3 aria-hidden="true" size={20} strokeWidth={1.8} />
            <input
              id={`${prefix}-time`}
              name={`${prefix}-time`}
              className="compat-air-input"
              type="time"
              value={time}
              disabled={timePrecision === 'unknown'}
              onChange={(event) => {
                if (timePrecision === 'unknown') onTimePrecisionChange('exact');
                onTimeChange(event.target.value);
              }}
            />
          </span>
        </label>
      </div>

      <div className="compat-time-precision-row">
        <span id={timePrecisionLabelId} className="compat-air-label">
          {ru ? 'Точность времени' : 'Time accuracy'}
        </span>
        <div className="compat-time-precision-options" role="radiogroup" aria-labelledby={timePrecisionLabelId}>
          {timePrecisionOptions.map((option) => {
            const active = timePrecision === option.value;
            return (
              <button
                key={option.value}
                type="button"
                role="radio"
                aria-checked={active}
                className={`compat-time-precision-option${active ? ' is-active' : ''}`}
                onClick={() => {
                  lumiaSelectionHaptic();
                  onTimePrecisionChange(option.value);
                  if (option.value === 'unknown') onTimeChange('');
                }}
              >
                {option.label}
              </button>
            );
          })}
        </div>
      </div>

      <label className="compat-air-field compat-air-field--place" htmlFor={`${prefix}-place`}>
        <span className="compat-air-label">{ru ? 'Место рождения' : 'Birth place'}</span>
        <span className="compat-air-control">
          <MapPin aria-hidden="true" size={20} strokeWidth={1.8} />
          <input name={`${prefix}-place`} id={`${prefix}-place`} className="compat-air-input" value={place} onChange={(event) => onPlaceChange(event.target.value)} placeholder={ru ? 'Город, страна' : 'City, country'} autoComplete="address-level2" />
        </span>
      </label>

      <div className="compat-air-person-footer">
        <div className="compat-air-gender-field">
          <span id={genderLabelId} className="compat-air-label">{ru ? 'Пол' : 'Gender'}</span>
          <GenderToggle value={gender} onChange={onGenderChange} ru={ru} labelledBy={genderLabelId} />
        </div>
      </div>
    </div>
  );
}

function PersonSavedFields({
  prefix,
  ru,
  charts,
  value,
  disabledChartId,
  gender,
  onChange,
  onGenderChange,
  onOpenCharts,
}: {
  prefix: string;
  ru: boolean;
  charts: ChartListItem[];
  value: number | null;
  disabledChartId: number | null;
  gender: CompatGender;
  onChange: (value: number | null) => void;
  onGenderChange: (value: CompatGender) => void;
  onOpenCharts?: () => void;
}) {
  const selectedChart = charts.find((chart) => chart.id === value) || null;
  const genderLabelId = `${prefix}-saved-gender-label`;
  return (
    <div className="compat-saved-fields">
      <label className="compat-air-field" htmlFor={`${prefix}-chart`}>
        <span className="compat-air-label">{ru ? 'Сохранённая карта' : 'Saved chart'}</span>
        <select
          id={`${prefix}-chart`}
          name={`${prefix}-chart`}
          className="compat-air-input compat-air-select"
          value={value ?? ''}
          onChange={(event) => onChange(event.target.value ? Number(event.target.value) : null)}
        >
          <option value="">{ru ? 'Выбрать карту' : 'Choose a chart'}</option>
          {charts.map((chart) => (
            <option key={chart.id} value={chart.id} disabled={chart.id === disabledChartId}>
              {chart.name}{chart.subject_type === 'self' ? (ru ? ' · основная' : ' · primary') : ''}
            </option>
          ))}
        </select>
      </label>
      {charts.length ? (
        <div className="compat-saved-quick" role="list" aria-label={ru ? 'Быстрый выбор сохранённой карты' : 'Quick saved chart selection'}>
          {charts.map((chart) => {
            const active = chart.id === value;
            const disabled = chart.id === disabledChartId;
            return (
              <button
                key={chart.id}
                type="button"
                role="listitem"
                className={`compat-saved-quick-option${active ? ' is-active' : ''}`}
                aria-pressed={active}
                disabled={disabled}
                title={chart.name}
                onClick={() => onChange(chart.id)}
              >
                <span>{chart.name}</span>
                {chart.subject_type === 'self' ? <small>{ru ? 'моя' : 'mine'}</small> : null}
              </button>
            );
          })}
        </div>
      ) : null}
      <div className="compat-air-gender-field">
        <span id={genderLabelId} className="compat-air-label">{ru ? 'Пол' : 'Gender'}</span>
        <GenderToggle value={gender} onChange={onGenderChange} ru={ru} labelledBy={genderLabelId} />
      </div>
      <div className="compat-saved-meta">
        {selectedChart
          ? `${formatDisplayDate(selectedChart.birth_date, ru ? 'ru' : 'en')}${selectedChart.birth_place ? ` · ${selectedChart.birth_place}` : ''}`
          : (ru ? 'Карта не выбрана' : 'No chart selected')}
      </div>
      {onOpenCharts ? (
        <button type="button" className="compat-air-add-chart" onClick={onOpenCharts}>
          {ru ? '+ Добавить карту' : '+ Add chart'}
        </button>
      ) : null}
    </div>
  );
}

function PersonSignFields({
  prefix,
  ru,
  language,
  sign,
  gender,
  onSignChange,
  onGenderChange,
}: {
  prefix: string;
  ru: boolean;
  language: UserProfile['language'];
  sign: string;
  gender: CompatGender;
  onSignChange: (value: string) => void;
  onGenderChange: (value: CompatGender) => void;
}) {
  const genderLabelId = `${prefix}-sign-gender-label`;
  const lang: 'ru' | 'en' = language === 'en' ? 'en' : 'ru';
  return (
    <div className="compat-sign-fields">
      <label className="compat-air-field" htmlFor={`${prefix}-sign`}>
        <span className="compat-air-label">{ru ? 'Знак зодиака' : 'Zodiac sign'}</span>
        <span className="compat-sign-select-wrap">
          <ZodiacSymbol sign={sign} size={28} />
          <select name={`${prefix}-sign`} id={`${prefix}-sign`} className="compat-air-input compat-air-select" value={sign} onChange={(event) => onSignChange(event.target.value)}>
            {ZODIAC_KEYS.map((key) => <option key={key} value={key}>{getZodiacSign(lang, key)}</option>)}
          </select>
        </span>
      </label>
      <div className="compat-air-gender-field">
        <span id={genderLabelId} className="compat-air-label">{ru ? 'Пол' : 'Gender'}</span>
        <GenderToggle value={gender} onChange={onGenderChange} ru={ru} labelledBy={genderLabelId} />
      </div>
    </div>
  );
}

function genderWord(g: CompatGender, ru: boolean): string {
  return ru ? (g === 'male' ? 'Мужчина' : 'Женщина') : (g === 'male' ? 'Male' : 'Female');
}

function SignSwipePicker({
  label,
  signs,
  active,
  language,
  onPick,
}: {
  label: string;
  signs: readonly string[];
  active: string;
  language: UserProfile['language'];
  onPick: (sign: string) => void;
}) {
  const trackRef = useRef<HTMLDivElement | null>(null);
  const scrollTimerRef = useRef<number | null>(null);
  const lang: 'ru' | 'en' = language === 'en' ? 'en' : 'ru';
  const activeKey = active.toLowerCase();

  const centerSign = (sign: string, behavior: ScrollBehavior) => {
    const track = trackRef.current;
    if (!track) return;
    const option = Array.from(track.querySelectorAll<HTMLButtonElement>('[data-sign]'))
      .find((candidate) => candidate.dataset.sign?.toLowerCase() === sign.toLowerCase());
    if (!option) return;
    const left = option.offsetLeft - (track.clientWidth - option.offsetWidth) / 2;
    track.scrollTo({ left, behavior });
  };

  useEffect(() => {
    const frame = window.requestAnimationFrame(() => centerSign(active, 'auto'));
    return () => window.cancelAnimationFrame(frame);
  }, [active]);

  useEffect(() => () => {
    if (scrollTimerRef.current) window.clearTimeout(scrollTimerRef.current);
  }, []);

  const selectCenteredSign = () => {
    const track = trackRef.current;
    if (!track) return;
    const trackCenter = track.scrollLeft + track.clientWidth / 2;
    let nearest: HTMLButtonElement | null = null;
    let nearestDistance = Number.POSITIVE_INFINITY;
    for (const option of Array.from(track.querySelectorAll<HTMLButtonElement>('[data-sign]'))) {
      const optionCenter = option.offsetLeft + option.offsetWidth / 2;
      const distance = Math.abs(optionCenter - trackCenter);
      if (distance < nearestDistance) {
        nearest = option;
        nearestDistance = distance;
      }
    }
    const sign = nearest?.dataset.sign;
    if (sign && sign.toLowerCase() !== activeKey) onPick(sign);
  };

  return (
    <section className="compat-sign-picker" aria-label={label}>
      <div className="compat-sign-picker-heading">
        <h2>{label}</h2>
        <span className="compat-sign-selected" aria-live="polite">
          <ZodiacSymbol sign={active} size={22} />
          {getZodiacSign(lang, active)}
        </span>
      </div>
      <div
        ref={trackRef}
        className="compat-sign-track scrollbar-hide"
        role="listbox"
        aria-label={label}
        onScroll={() => {
          if (scrollTimerRef.current) window.clearTimeout(scrollTimerRef.current);
          scrollTimerRef.current = window.setTimeout(selectCenteredSign, 90);
        }}
      >
        {signs.map((sign) => {
          const selected = sign.toLowerCase() === activeKey;
          return (
            <button
              key={sign}
              type="button"
              role="option"
              data-sign={sign}
              aria-selected={selected}
              className={`compat-sign-option${selected ? ' is-selected' : ''}`}
              onClick={() => {
                onPick(sign);
                centerSign(sign, 'smooth');
              }}
            >
              <ZodiacSymbol sign={sign} size={34} />
              <span>{getZodiacSign(lang, sign)}</span>
            </button>
          );
        })}
      </div>
    </section>
  );
}

function RelationshipContextPicker({
  focus,
  onChange,
  ru,
  compact = false,
}: {
  focus: CompatibilityFocus;
  onChange: (focus: CompatibilityFocus, context: RelationshipContext) => void;
  ru: boolean;
  compact?: boolean;
}) {
  return (
    <div className={`compat-context-picker ${compact ? 'is-compact' : ''}`}>
      {!compact ? (
        <div className="compat-context-heading">
          <span>{ru ? 'Какие у вас отношения?' : 'What is the relationship?'}</span>
          <small>{ru ? 'Разбор будет говорить именно об этом' : 'The reading will stay in this context'}</small>
        </div>
      ) : null}
      <div className="compat-choice-tabs compat-context-options" role="radiogroup" aria-label={ru ? 'Тип отношений' : 'Relationship type'}>
        {COMPATIBILITY_FOCUS_OPTIONS.map((option) => {
          const active = option.value === focus;
          return (
            <button
              key={option.value}
              type="button"
              role="radio"
              aria-checked={active}
              className={`compat-choice-tab compat-context-option ${active ? 'is-active' : ''}`}
              onClick={() => {
                lumiaSelectionHaptic();
                onChange(option.value, option.context);
              }}
            >
              <span>{ru ? option.label.ru : option.label.en}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

function readingTitles(context: RelationshipContext, ru: boolean) {
  if (context === 'friendship') {
    return ru
      ? ['Почему вам легко быть своими', 'Где дружба начинает трещать', 'Как не копить недосказанное']
      : ['Why it feels easy to be yourselves', 'Where friendship starts to crack', 'How to avoid the unsaid'];
  }
  if (context === 'work') {
    return ru
      ? ['Где вы усиливаете друг друга', 'Что ломает совместную работу', 'Как договариваться без хаоса']
      : ['Where you improve each other', 'What breaks the work', 'How to agree without chaos'];
  }
  if (context === 'family') {
    return ru
      ? ['Что держит вашу связь', 'Где включаются старые роли', 'Как говорить без семейного багажа']
      : ['What holds the bond', 'Where old roles take over', 'How to speak without old baggage'];
  }
  return ru
    ? ['Почему вас тянет друг к другу', 'Что может быть непросто', 'Как лучше понимать друг друга']
    : ["Why you're drawn to each other", 'What can get tricky', 'How to understand each other'];
}

function deepReadingTitles(context: RelationshipContext, ru: boolean) {
  if (context === 'relationship') {
    return ru
      ? ['Что между вами', 'Эмоциональная близость', 'Как вы проживаете конфликты', 'Что делает связь устойчивее']
      : ['What happens between you', 'Emotional closeness', 'How you handle conflict', 'What makes the bond steadier'];
  }
  if (context === 'friendship') {
    return ru
      ? ['На чём держится дружба', 'Что вас объединяет', 'Где появляются трения', 'Как сохранить взаимность']
      : ['What holds the friendship', 'What unites you', 'Where friction starts', 'How to keep it mutual'];
  }
  if (context === 'work') {
    return ru
      ? ['Как вы работаете вместе', 'Где усиливаете результат', 'Что тормозит', 'Как сделать союз рабочим']
      : ['How you work together', 'Where you improve the result', 'What slows you down', 'How to make it work'];
  }
  if (context === 'family') {
    return ru
      ? ['Как устроена ваша связь', 'Что помогает быть ближе', 'Из-за чего спор повторяется', 'Что меняет семейный сценарий']
      : ['How the bond works', 'What helps you stay close', 'Why the argument repeats', 'What changes the family pattern'];
  }
  return ru
    ? ['Какая у вас связь', 'Что вас сближает', 'Из-за чего бывают трения', 'Что сделает вас крепче']
    : ['What your bond is like', 'What brings you closer', 'Where friction comes from', 'What makes you stronger'];
}

/* Один редакционный раздел без цветной карточки. */
function CompatBlock({ title, index, reduce, children }: {
  title: string; index: number; reduce: boolean | null; children?: string | null;
}) {
  if (!children) return null;
  return (
    <motion.section
      className="compat-read-block"
      initial={reduce ? false : { opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={reduce ? { duration: 0 } : { duration: 0.4, delay: 0.05 * index, ease: [0.22, 1, 0.36, 1] }}
    >
      <EditorialSectionHeading title={title} className="compat-read-heading" />
      <EditorialProse text={children} className="compat-read-text" />
    </motion.section>
  );
}

export function UnionRoom(props: UnionRoomProps) {
  const {
    profile,
    chartData,
    chartId,
    requestPremium,
    initialPrefill,
    onOpenCharts,
    premiumContinuation,
    onPremiumContinuationHandled,
    canPromotePremium = true,
    uiPreview,
  } = props;
  const ru = profile.language !== 'en';
  const lang: 'ru' | 'en' = ru ? 'ru' : 'en';
  const reduce = useReducedMotion();

  const premium = hasActivePremium(profile);
  const previewFixture = process.env.NODE_ENV === 'development' ? uiPreview : undefined;
  const yourSun = useMemo(
    () => String(chartData?.sun?.sign || profile.selectedZodiacSign || sunSignFromDate(profile.birthDate) || 'aries').toLowerCase(),
    [chartData, profile.selectedZodiacSign, profile.birthDate],
  );

  // Пол по умолчанию: «ты» — из профиля (иначе М), партнёр — противоположный (как в трендовых приложениях).
  const initialYouGender: CompatGender = profile.gender === 'female' ? 'female' : 'male';
  const initialThemGender: CompatGender = initialYouGender === 'male' ? 'female' : 'male';

  const previewEnabled = Boolean(previewFixture);
  const previewResultState = previewFixture?.resultState;
  const [screen, setScreen] = useState<'add' | 'result'>(
    previewFixture?.screen === 'result' || initialPrefill ? 'result' : 'add',
  );
  const [entryMode, setEntryMode] = useState<'birth' | 'sign'>(
    previewFixture ? (previewFixture.screen === 'signs' ? 'sign' : 'birth') : premium ? 'birth' : 'sign',
  );
  const [availableCharts, setAvailableCharts] = useState<ChartListItem[]>([]);
  const [peopleLoaded, setPeopleLoaded] = useState(previewEnabled);
  const [firstChartId, setFirstChartId] = useState<number | null>(null);
  const [secondChartId, setSecondChartId] = useState<number | null>(initialPrefill?.partnerChartId ?? null);
  const [subjectSource, setSubjectSource] = useState<CompatibilityPersonSource>(initialPrefill && chartId ? 'saved' : 'birth');
  const [partnerSource, setPartnerSource] = useState<CompatibilityPersonSource>(initialPrefill?.partnerChartId ? 'saved' : 'birth');
  const [history, setHistory] = useState<CompatHistoryEntry[]>([]);
  const [pickSign, setPickSign] = useState<string>(() => ZODIAC_KEYS.find((s) => s.toLowerCase() !== yourSun) || ZODIAC_KEYS[0]);
  // «Твой» знак теперь можно менять (не жёстко из карты). По умолчанию — солнечный знак из карты.
  const [youSign, setYouSign] = useState<string>(yourSun);
  const [youGender, setYouGender] = useState<CompatGender>(initialYouGender);
  const [themGender] = useState<CompatGender>(initialThemGender);
  const [relationshipContext, setRelationshipContext] = useState<RelationshipContext>('romance');
  const [relationshipFocus, setRelationshipFocus] = useState<CompatibilityFocus>('love');
  const [selected, setSelected] = useState<Selected | null>(
    previewFixture?.screen === 'result'
      ? previewFixture.resultKind === 'sign'
        ? {
            kind: 'sign',
            relationshipContext: previewFixture.deepResult.relationshipContext || 'romance',
            youSign: previewFixture.subject.sign,
            sign: previewFixture.partner.sign,
            subjectSign: previewFixture.subject.sign,
            partnerSign: previewFixture.partner.sign,
            youGender: initialYouGender,
            themGender: initialThemGender,
            calculationLevel: 'sign_only',
          }
        : {
          kind: 'person',
          relationshipContext: previewFixture.deepResult.relationshipContext || 'romance',
          youSign: previewFixture.subject.sign,
          youGender: initialYouGender,
          themGender: initialThemGender,
          subjectName: previewFixture.subject.name,
          subjectDate: previewFixture.subject.date,
          subjectTime: previewFixture.subject.time,
          subjectBirthTimeQuality: chartData?.birthTimeQuality || 'exact',
          subjectPlace: previewFixture.subject.place,
          subjectSource: 'birth',
          subjectSign: previewFixture.subject.sign,
          name: previewFixture.partner.name,
          date: previewFixture.partner.date,
          time: previewFixture.partner.time,
          partnerBirthTimeQuality: chartData?.birthTimeQuality || 'exact',
          place: previewFixture.partner.place,
          partnerSource: 'birth',
          partnerSign: previewFixture.partner.sign,
          calculationLevel: chartData?.birthTimeQuality === 'exact' ? 'full' : 'reduced',
        }
      : initialPrefill
      ? {
          kind: 'person',
          relationshipContext: 'romance',
          youSign: yourSun,
          youGender: initialYouGender,
          themGender: initialThemGender,
          subjectChartId: chartId ?? undefined,
          subjectName: profile.name,
          subjectDate: profile.birthDate,
          subjectTime: profile.birthTime,
          subjectBirthTimeQuality: profile.birthTimeMode === 'approximate'
            ? 'approximate'
            : profile.birthTime ? 'exact' : 'unknown',
          subjectPlace: profile.birthPlace,
          subjectSource: chartId ? 'saved' : 'birth',
          subjectSign: yourSun,
          name: initialPrefill.partnerName || '',
          date: toDateInputValue(initialPrefill.partnerDate || ''),
          time: initialPrefill.partnerTime,
          partnerBirthTimeQuality: initialPrefill.partnerTime ? 'exact' : 'unknown',
          place: initialPrefill.partnerPlace,
          chartId: initialPrefill.partnerChartId,
          partnerSource: initialPrefill.partnerChartId ? 'saved' : 'birth',
          partnerSign: sunSignFromDate(initialPrefill.partnerDate || '') || undefined,
          calculationLevel: 'full',
        }
      : null,
  );

  const [sName, setSName] = useState(previewFixture?.subject.name || '');
  const [sDate, setSDate] = useState(previewFixture?.subject.date || '');
  const [sTime, setSTime] = useState(previewFixture?.subject.time || '');
  const [sTimePrecision, setSTimePrecision] = useState<BirthTimeQuality>('exact');
  const [sPlace, setSPlace] = useState(previewFixture?.subject.place || '');
  const [fName, setFName] = useState(previewFixture?.partner.name || initialPrefill?.partnerName || '');
  const [fDate, setFDate] = useState(() => toDateInputValue(previewFixture?.partner.date || initialPrefill?.partnerDate || ''));
  const [fTime, setFTime] = useState(previewFixture?.partner.time || initialPrefill?.partnerTime || '');
  const [fTimePrecision, setFTimePrecision] = useState<BirthTimeQuality>('exact');
  const [fPlace, setFPlace] = useState(previewFixture?.partner.place || initialPrefill?.partnerPlace || '');
  const [fGender, setFGender] = useState<CompatGender>(initialThemGender);

  const [signText, setSignText] = useState<SignCompatibilityResult | null>(
    previewFixture?.screen === 'result' ? previewFixture.signCompatibility : null,
  );
  const [deep, setDeep] = useState<SynastryResult | null>(
    previewFixture?.screen === 'result' && previewFixture.resultKind !== 'sign' && premium && !previewResultState
      ? previewFixture.deepResult
      : null,
  );
  const [deepReactionKey, setDeepReactionKey] = useState<string | null>(
    previewFixture?.screen === 'result' && previewFixture.resultKind !== 'sign' ? 'deep:v1:preview' : null,
  );
  const [deepLoading, setDeepLoading] = useState(previewResultState === 'loading');
  const autoDeepKeyRef = useRef<string | null>(null);
  const [error, setError] = useState<string | null>(
    previewResultState === 'error'
      ? (ru ? 'Не удалось собрать подробный разбор. Проверь соединение и попробуй ещё раз.' : 'Could not prepare the detailed reading. Check your connection and try again.')
      : null,
  );

  useEffect(() => {
    if (previewEnabled) return;
    if (!profile.id || !premium) {
      setAvailableCharts([]);
      setPeopleLoaded(true);
      return;
    }
    setPeopleLoaded(false);
    void getCharts(profile.id)
      .then((d) => {
        const readable = (d.charts || []).filter((chart) => !chart.archived_at && !chart.access_locked);
        setAvailableCharts(readable);
        setFirstChartId((current) => (
          current && readable.some((chart) => chart.id === current) ? current : null
        ));
        setSecondChartId((current) => (
          current && readable.some((chart) => chart.id === current) ? current : null
        ));
      })
      .catch(() => {
        setAvailableCharts([]);
      })
      .finally(() => setPeopleLoaded(true));
  }, [profile.id, premium, chartId, previewEnabled]);

  useEffect(() => {
    if (!premium) {
      setEntryMode('sign');
      setDeep(null);
      setDeepReactionKey(null);
      setDeepLoading(false);
      autoDeepKeyRef.current = null;
    }
  }, [premium]);

  useEffect(() => {
    if (firstChartId == null || secondChartId !== firstChartId) return;
    setSecondChartId(null);
  }, [firstChartId, secondChartId]);

  useEffect(() => {
    if (!peopleLoaded || selected?.kind !== 'person') return;
    const subjectMissing = selected.subjectChartId != null
      && !availableCharts.some((chart) => chart.id === selected.subjectChartId);
    const partnerMissing = selected.chartId != null
      && !availableCharts.some((chart) => chart.id === selected.chartId);
    if (!subjectMissing && !partnerMissing) return;
    setSelected(null);
    setScreen('add');
  }, [peopleLoaded, availableCharts, selected]);

  // История — ТОЛЬКО по конкретным людям (имя+дата+разбор). Проверки по знакам не храним.
  useEffect(() => {
    if (previewEnabled) {
      setHistory([]);
      return;
    }
    setHistory(loadCompatHistory(profile.id).filter((entry) => entry.kind === 'person'));
  }, [profile.id, previewEnabled]);

  const firstChart = useMemo(
    () => availableCharts.find((chart) => chart.id === firstChartId) || null,
    [availableCharts, firstChartId],
  );
  const secondChart = useMemo(
    () => availableCharts.find((chart) => chart.id === secondChartId) || null,
    [availableCharts, secondChartId],
  );
  const ownSavedChart = useMemo(
    () => availableCharts.find((chart) => chart.subject_type === 'self') || null,
    [availableCharts],
  );
  const subjectResolvedSource: CompatibilityPersonSource = subjectSource;
  const partnerResolvedSource: CompatibilityPersonSource = partnerSource;
  const subjectClassification = useMemo(() => classifyCompatibilityPerson({
    source: subjectResolvedSource,
    chartId: firstChart?.id,
    date: subjectResolvedSource === 'saved' ? firstChart?.birth_date : subjectResolvedSource === 'birth' ? sDate : '',
    time: subjectResolvedSource === 'saved'
      ? firstChart?.birth_time
      : subjectResolvedSource === 'birth' && sTimePrecision !== 'unknown'
        ? sTime
        : '',
    place: subjectResolvedSource === 'saved' ? firstChart?.birth_place : subjectResolvedSource === 'birth' ? sPlace : '',
    sign: subjectResolvedSource === 'sign' ? youSign : firstChart?.chart_data?.sun?.sign,
    chartBirthTimeQuality: (firstChart?.chart_data as any)?.birthTimeQuality,
    birthTimeQuality: subjectResolvedSource === 'birth' ? sTimePrecision : undefined,
  }), [subjectResolvedSource, firstChart, sDate, sTime, sTimePrecision, sPlace, youSign]);
  const partnerClassification = useMemo(() => classifyCompatibilityPerson({
    source: partnerResolvedSource,
    chartId: secondChart?.id,
    date: partnerResolvedSource === 'saved' ? secondChart?.birth_date : partnerResolvedSource === 'birth' ? fDate : '',
    time: partnerResolvedSource === 'saved'
      ? secondChart?.birth_time
      : partnerResolvedSource === 'birth' && fTimePrecision !== 'unknown'
        ? fTime
        : '',
    place: partnerResolvedSource === 'saved' ? secondChart?.birth_place : partnerResolvedSource === 'birth' ? fPlace : '',
    sign: partnerResolvedSource === 'sign' ? pickSign : secondChart?.chart_data?.sun?.sign,
    chartBirthTimeQuality: (secondChart?.chart_data as any)?.birthTimeQuality,
    birthTimeQuality: partnerResolvedSource === 'birth' ? fTimePrecision : undefined,
  }), [partnerResolvedSource, secondChart, fDate, fTime, fTimePrecision, fPlace, pickSign]);
  const draftCalculationLevel = useMemo(
    () => resolveCompatibilityPairLevel(subjectClassification, partnerClassification),
    [subjectClassification, partnerClassification],
  );

  // Левая сторона результата всегда соответствует первой выбранной карте или знаку.
  const leftSun = selected?.youSign || yourSun;
  const leftGender = selected?.youGender ?? youGender;
  const rightGender = selected?.themGender ?? themGender;
  const theirSun = selected
    ? String(selected.partnerSign || selected.sign || sunSignFromDate(selected.date) || 'libra').toLowerCase()
    : 'libra';
  const score: CompatResult | null = selected ? getCompatScore(leftSun, theirSun, lang) : null;
  const theirName = selected ? (selected.kind === 'sign' ? getZodiacSign(lang, theirSun) : (selected.name || (ru ? 'Человек' : 'Person'))) : '';

  useEffect(() => {
    if (screen !== 'result' || !selected) return;
    if (previewFixture) {
      setSignText(previewFixture.signCompatibility);
      if (selected.kind === 'person' && premium && !previewResultState) setDeep(previewFixture.deepResult);
      return;
    }
    let alive = true;
    void getSignCompatibility(
      leftSun,
      theirSun,
      lang,
      leftGender,
      rightGender,
      selected.relationshipContext,
    )
      .then((r) => { if (alive) setSignText(r); })
      .catch(() => { /* optional */ });
    return () => { alive = false; };
  }, [screen, selected, leftSun, theirSun, lang, leftGender, rightGender, previewFixture, previewResultState, premium]);

  const sunOf = (s: Selected) => String(s.partnerSign || s.sign || sunSignFromDate(s.date) || 'libra').toLowerCase();

  const scrollCompatibilityToTop = () => {
    window.requestAnimationFrame(() => {
      document.querySelector<HTMLElement>('.lumia-main-scroll')?.scrollTo({ top: 0, behavior: 'auto' });
      window.scrollTo({ top: 0, behavior: 'auto' });
    });
  };

  const openResult = (s: Selected) => {
    lumiaSelectionHaptic();
    autoDeepKeyRef.current = null;
    setDeepLoading(false);
    setSignText(null);
    setDeep(null);
    setDeepReactionKey(null);
    setError(null);
    setSelected(s);
    setScreen('result');
    scrollCompatibilityToTop();
  };

  const persistCalculatedHistory = (entry: Selected, overall: number) => {
    if (entry.kind !== 'person' || previewEnabled) return;
    const their = sunOf(entry);
    setHistory(addCompatHistory({
      id: buildCompatHistoryId(entry.kind, entry.sign, entry.name, entry.date, entry.relationshipContext, entry.subjectChartId, entry.chartId),
      kind: entry.kind,
      sign: entry.sign,
      name: entry.name,
      date: entry.date,
      time: entry.time,
      partnerBirthTimeQuality: entry.partnerBirthTimeQuality,
      place: entry.place,
      chartId: entry.chartId,
      subjectChartId: entry.subjectChartId,
      subjectName: entry.subjectName,
      subjectDate: entry.subjectDate,
      subjectTime: entry.subjectTime,
      subjectBirthTimeQuality: entry.subjectBirthTimeQuality,
      subjectPlace: entry.subjectPlace,
      subjectSource: entry.subjectSource,
      partnerSource: entry.partnerSource,
      subjectSign: entry.subjectSign,
      partnerSign: entry.partnerSign,
      calculationLevel: entry.calculationLevel,
      yourSun: entry.youSign,
      theirSun: their,
      yourGender: entry.youGender,
      theirGender: entry.themGender,
      relationshipContext: entry.relationshipContext,
      overall,
      ts: Date.now(),
    }, profile.id));
  };

  const openFromHistory = (e: CompatHistoryEntry) => {
    const yg: CompatGender = e.yourGender === 'female' ? 'female' : 'male';
    const tg: CompatGender = e.theirGender === 'male' ? 'male' : 'female';
    const context = normalizeRelationshipContext(e.relationshipContext);
    setRelationshipContext(context);
    setRelationshipFocus(compatibilityFocusForContext(context));
    const base = {
      relationshipContext: context,
      youSign: e.yourSun || yourSun,
      youGender: yg,
      themGender: tg,
      subjectChartId: e.subjectChartId,
      subjectName: e.subjectName,
      subjectDate: e.subjectDate,
      subjectTime: e.subjectTime,
      subjectBirthTimeQuality: e.subjectBirthTimeQuality,
      subjectPlace: e.subjectPlace,
      subjectSource: e.subjectSource,
      subjectSign: e.subjectSign,
    };
    if (e.kind === 'sign') openResult({ kind: 'sign', sign: e.sign, ...base });
    else openResult({
      kind: 'person',
      name: e.name,
      date: e.date,
      time: e.time,
      partnerBirthTimeQuality: e.partnerBirthTimeQuality,
      place: e.place,
      chartId: e.chartId,
      partnerSource: e.partnerSource,
      partnerSign: e.partnerSign,
      calculationLevel: e.calculationLevel,
      ...base,
    });
  };

  const deleteHistory = (id: string, ev: React.MouseEvent) => {
    ev.stopPropagation();
    lumiaSelectionHaptic();
    setHistory(removeCompatHistory(id, profile.id));
  };

  const deleteAllHistory = () => {
    const confirmed = window.confirm(
      ru
        ? 'Удалить всю историю сравнений? Вернуть её не получится.'
        : 'Delete all comparison history? This cannot be undone.',
    );
    if (!confirmed) return;
    lumiaSelectionHaptic();
    setHistory(clearCompatHistory(profile.id));
  };

  const shareCompat = () => {
    if (!selected || previewEnabled) return;
    const first = selected.kind === 'sign'
      ? getZodiacSign(lang, leftSun)
      : (selected.subjectName || profile.name || (ru ? 'Первая карта' : 'First chart'));
    const second = selected.kind === 'sign'
      ? getZodiacSign(lang, theirSun)
      : (selected.name || (ru ? 'Вторая карта' : 'Second chart'));
    const text = selected.kind === 'person'
      ? ru
        ? `Совместимость ${first} + ${second}: ${deep?.summary || 'подробный разбор по вашим данным'}.\n\nСравни свою пару в NEBO.`
        : `Compatibility ${first} + ${second}: ${deep?.summary || 'a detailed reading based on your data'}.\n\nCompare your pair in NEBO.`
      : score
        ? ru
          ? `Совместимость ${first} + ${second}: ${score.overall}/100 — ${score.verdict}. Сильнее всего — ${DIMENSION_LABELS[score.strongest][lang]}.\n\nСравни свою пару в NEBO.`
          : `Compatibility ${first} + ${second}: ${score.overall}/100 — ${score.verdict}. Strongest — ${DIMENSION_LABELS[score.strongest][lang]}.\n\nCompare your pair in NEBO.`
        : '';
    if (!text) return;
    shareToTelegram(text);
  };

  const submitAdd = () => {
    if (subjectSource === 'birth' && !sDate) {
      setError(ru ? 'Укажи дату рождения первого человека или выбери знак.' : 'Add the first person\'s birth date or choose a sign.');
      return;
    }
    if (partnerSource === 'birth' && !fDate) {
      setError(ru ? 'Укажи дату рождения второго человека или выбери знак.' : 'Add the second person\'s birth date or choose a sign.');
      return;
    }
    if (subjectSource === 'birth' && sTimePrecision !== 'unknown' && !sTime) {
      setError(ru ? 'Укажи время рождения первого человека или выбери «Не знаю».' : 'Add the first person\'s birth time or choose “Unknown”.');
      return;
    }
    if (partnerSource === 'birth' && fTimePrecision !== 'unknown' && !fTime) {
      setError(ru ? 'Укажи время рождения второго человека или выбери «Не знаю».' : 'Add the second person\'s birth time or choose “Unknown”.');
      return;
    }
    if (subjectResolvedSource === 'sign' && partnerResolvedSource === 'sign') {
      setError(null);
      openResult({
        kind: 'sign',
        relationshipContext,
        sign: pickSign,
        partnerSign: pickSign,
        subjectSign: youSign,
        youSign,
        youGender,
        themGender: fGender,
        calculationLevel: 'sign_only',
      });
      return;
    }
    if (!premium) {
      void requestPremium('compatibility_by_charts', {
        placement: 'compatibility_by_charts',
        featureKey: 'synastry_by_charts',
        triggerType: 'locked_feature',
        returnView: 'synastry',
        returnAction: 'submit_birth_compatibility',
      });
      return;
    }
    if (subjectResolvedSource === 'saved' && !firstChart) {
      setError(ru ? 'Выбери сохранённую карту первого человека.' : 'Choose a saved chart for the first person.');
      return;
    }
    if (partnerResolvedSource === 'saved' && !secondChart) {
      setError(ru ? 'Выбери сохранённую карту второго человека.' : 'Choose a saved chart for the second person.');
      return;
    }
    if (subjectResolvedSource === 'saved' && partnerResolvedSource === 'saved' && firstChartId != null && secondChartId === firstChartId) {
      setError(ru ? 'Для сравнения нужны две разные карты.' : 'Choose two different charts.');
      return;
    }

    const subjectName = subjectSource === 'saved'
      ? firstChart?.name || ''
      : subjectSource === 'sign'
        ? getZodiacSign(lang, youSign)
        : sName.trim() || (ru ? 'Первый человек' : 'First person');
    const subjectDate = subjectResolvedSource === 'saved' ? firstChart?.birth_date || '' : subjectResolvedSource === 'birth' ? sDate : '';
    const subjectTime = subjectResolvedSource === 'saved'
      ? firstChart?.birth_time || undefined
      : subjectResolvedSource === 'birth' && sTimePrecision !== 'unknown'
        ? sTime || undefined
        : undefined;
    const subjectPlace = subjectResolvedSource === 'saved' ? firstChart?.birth_place || '' : subjectResolvedSource === 'birth' ? sPlace.trim() : '';
    const subjectBirthTimeQuality: BirthTimeQuality = subjectResolvedSource === 'saved'
      ? ((firstChart?.chart_data as any)?.birthTimeQuality || (subjectTime ? 'exact' : 'unknown'))
      : subjectResolvedSource === 'birth'
        ? sTimePrecision
        : 'unknown';
    const subjectResolvedSign = String(
      subjectResolvedSource === 'sign'
        ? youSign
        : firstChart?.chart_data?.sun?.sign || sunSignFromDate(subjectDate) || youSign,
    ).toLowerCase();

    const partnerName = partnerSource === 'saved'
      ? secondChart?.name || ''
      : partnerSource === 'sign'
        ? getZodiacSign(lang, pickSign)
        : fName.trim() || (ru ? 'Второй человек' : 'Second person');
    const partnerDate = partnerResolvedSource === 'saved' ? secondChart?.birth_date || '' : partnerResolvedSource === 'birth' ? fDate : '';
    const partnerTime = partnerResolvedSource === 'saved'
      ? secondChart?.birth_time || undefined
      : partnerResolvedSource === 'birth' && fTimePrecision !== 'unknown'
        ? fTime || undefined
        : undefined;
    const partnerPlace = partnerResolvedSource === 'saved' ? secondChart?.birth_place || '' : partnerResolvedSource === 'birth' ? fPlace.trim() : '';
    const partnerBirthTimeQuality: BirthTimeQuality = partnerResolvedSource === 'saved'
      ? ((secondChart?.chart_data as any)?.birthTimeQuality || (partnerTime ? 'exact' : 'unknown'))
      : partnerResolvedSource === 'birth'
        ? fTimePrecision
        : 'unknown';
    const partnerResolvedSign = String(
      partnerResolvedSource === 'sign'
        ? pickSign
        : secondChart?.chart_data?.sun?.sign || sunSignFromDate(partnerDate) || pickSign,
    ).toLowerCase();

    setError(null);
    openResult({
      kind: 'person',
      relationshipContext,
      subjectChartId: subjectResolvedSource === 'saved' ? firstChart?.id : undefined,
      subjectName,
      subjectDate,
      subjectTime,
      subjectBirthTimeQuality,
      subjectPlace,
      subjectSource: subjectResolvedSource,
      subjectSign: subjectResolvedSign,
      name: partnerName,
      date: partnerDate,
      time: partnerTime,
      partnerBirthTimeQuality,
      place: partnerPlace,
      chartId: partnerResolvedSource === 'saved' ? secondChart?.id : undefined,
      partnerSource: partnerResolvedSource,
      partnerSign: partnerResolvedSign,
      calculationLevel: draftCalculationLevel,
      youSign: subjectResolvedSign,
      youGender,
      themGender: fGender,
    });
  };

  const runDeep = useCallback(async () => {
    if (!selected || selected.kind !== 'person' || deepLoading) return;
    if (previewFixture) {
      setError(null);
      setDeep(previewFixture.deepResult);
      setDeepReactionKey('deep:v1:preview');
      setDeepLoading(false);
      return;
    }
    if (!premium) {
      void requestPremium('compatibility_by_charts', {
        placement: 'compatibility_by_charts',
        featureKey: 'synastry_by_charts',
        triggerType: 'locked_feature',
        returnView: 'synastry',
        returnAction: 'run_deep_compatibility',
      });
      return;
    }
    if (
      (selected.chartId != null && (!peopleLoaded || !availableCharts.some((chart) => chart.id === selected.chartId)))
      || (selected.subjectChartId != null && (!peopleLoaded || !availableCharts.some((chart) => chart.id === selected.subjectChartId)))
    ) {
      setSelected(null);
      setScreen('add');
      return;
    }
    const requestKey = [
      selected.subjectSource,
      selected.subjectChartId || `${selected.subjectName || ''}:${selected.subjectDate || ''}:${selected.subjectSign || ''}`,
      selected.subjectBirthTimeQuality,
      selected.partnerSource,
      selected.chartId || `${selected.name || ''}:${selected.date || ''}:${selected.partnerSign || ''}`,
      selected.partnerBirthTimeQuality,
      selected.relationshipContext,
    ].join('|');
    setDeepLoading(true); setError(null);
    try {
      const context = getRelationshipContextOption(selected.relationshipContext);
      const out = await calculateExtendedSynastry(
        profile,
        selected.name || '',
        selected.date || '',
        selected.time,
        selected.place,
        context.backendValue,
        selected.chartId,
        selected.subjectChartId,
        {
          name: selected.subjectName || '',
          date: selected.subjectDate || '',
          time: selected.subjectTime,
          place: selected.subjectPlace,
          source: selected.subjectSource,
          sign: selected.subjectSign,
          gender: selected.youGender,
          birthTimeQuality: selected.subjectBirthTimeQuality,
        },
        {
          source: selected.partnerSource,
          sign: selected.partnerSign,
          gender: selected.themGender,
          birthTimeQuality: selected.partnerBirthTimeQuality,
        },
        context.value,
      );
      if (autoDeepKeyRef.current === requestKey) {
        setDeep(out.result);
        setDeepReactionKey(out.contentKey || null);
        const resolvedLevel = out.result.calculationLevel || out.calculationLevel;
        if (resolvedLevel) {
          setSelected((current) => current ? { ...current, calculationLevel: resolvedLevel } : current);
          }
        const calculatedScore = out.result.overallScore ?? out.result.compatibilityScore;
        if (typeof calculatedScore === 'number') persistCalculatedHistory(selected, Math.round(calculatedScore));
      }
    } catch (e: any) {
      if (autoDeepKeyRef.current === requestKey) {
        setError(e?.message || (ru ? 'Не удалось собрать полный разбор.' : 'Could not build the full reading.'));
      }
    } finally {
      if (autoDeepKeyRef.current === requestKey) setDeepLoading(false);
    }
  }, [selected, deepLoading, premium, requestPremium, peopleLoaded, availableCharts, profile, ru, previewFixture]);

  useEffect(() => {
    if (!premium || !premiumContinuation || premiumContinuation.returnView !== 'synastry') return;
    if (premiumContinuation.featureKey !== 'synastry_by_charts') return;
    if (premiumContinuation.returnAction === 'run_deep_compatibility') {
      void runDeep();
    } else if (premiumContinuation.returnAction === 'submit_birth_compatibility') {
      submitAdd();
    } else {
      setEntryMode('birth');
      setScreen('add');
    }
    onPremiumContinuationHandled?.(premiumContinuation.paywallInstanceId);
  }, [
    onPremiumContinuationHandled,
    premium,
    premiumContinuation,
    runDeep,
  ]);

  useEffect(() => {
    if (previewResultState) return;
    if (screen !== 'result' || selected?.kind !== 'person' || !premium || !peopleLoaded) return;
    const key = [
      selected.subjectSource,
      selected.subjectChartId || `${selected.subjectName || ''}:${selected.subjectDate || ''}:${selected.subjectSign || ''}`,
      selected.subjectBirthTimeQuality,
      selected.partnerSource,
      selected.chartId || `${selected.name || ''}:${selected.date || ''}:${selected.partnerSign || ''}`,
      selected.partnerBirthTimeQuality,
      selected.relationshipContext,
    ].join('|');
    if (autoDeepKeyRef.current === key) return;
    autoDeepKeyRef.current = key;
    void runDeep();
  }, [screen, selected, premium, peopleLoaded, previewResultState, runDeep]);

  const compatibilityTabs = useMemo(() => [
    { id: 'birth' as const, label: ru ? 'По карте' : 'By birth data' },
    { id: 'sign' as const, label: ru ? 'По знакам' : 'By zodiac signs' },
  ], [ru]);
  const activeCompatibilityTab: CompatibilityTab = screen === 'result'
    ? selected?.kind === 'sign' ? 'sign' : 'birth'
      : entryMode === 'sign'
        ? 'sign'
        : 'birth';

  const selectCompatibilityTab = (tab: CompatibilityTab) => {
    lumiaSelectionHaptic();
    setError(null);
    if (tab === 'birth') {
      setEntryMode('birth');
      setScreen('add');
      scrollCompatibilityToTop();
      return;
    }
    setEntryMode('sign');
    setScreen('add');
    scrollCompatibilityToTop();
  };

  const compatibilityHeader = (withBack = false) => (
    <>
      <AppTopBar
        title={ru ? 'Совместимость' : 'Compatibility'}
        onBack={withBack ? () => {
          lumiaSelectionHaptic();
          setEntryMode(selected?.kind === 'sign' ? 'sign' : 'birth');
          setScreen('add');
          scrollCompatibilityToTop();
        } : undefined}
        rightAction={(
          <EditorialChartsButton
            label={ru ? 'Открыть мои карты' : 'Open my charts'}
            onClick={onOpenCharts}
          />
        )}
      />
      <EditorialTabs
        label={ru ? 'Режим совместимости' : 'Compatibility mode'}
        tabs={compatibilityTabs}
        activeTab={activeCompatibilityTab}
        onTabChange={selectCompatibilityTab}
        className="compat-editorial-tabs"
      />
    </>
  );

  /* ── ДОБАВЛЕНИЕ ── */
  if (screen === 'add') {
    return (
      <div className="fresh-page compat-editorial-page compat-editorial-page--add">
        {compatibilityHeader()}

        {entryMode === 'birth' ? (
          <>
            <form
              className="compat-entry-form"
              onSubmit={(event) => {
                event.preventDefault();
                submitAdd();
              }}
            >
              <details className="compat-entry-disclosure">
                <summary>
                  <span className="compat-entry-disclosure-icon" aria-hidden="true">
                    <Info size={14} strokeWidth={1.8} />
                  </span>
                  <strong>{ru ? 'Что покажет сравнение' : 'What the comparison will show'}</strong>
                  <ChevronDown aria-hidden="true" size={14} strokeWidth={1.8} />
                </summary>
                <div className="compat-entry-disclosure-body">
                  <p className="compat-entry-disclosure-lead">
                    {ru
                      ? 'Это не вердикт «подходите вы или нет». Разбор покажет, как устроена ваша связь и на что лучше обратить внимание.'
                      : 'This is not a verdict on whether you belong together. It shows how your connection works and what deserves attention.'}
                  </p>
                  <div className="compat-entry-disclosure-points">
                    <div className="compat-entry-disclosure-point">
                      <span aria-hidden="true" />
                      <p>
                        <strong>{ru ? 'Что вас сближает' : 'What brings you closer'}</strong>
                        <small>{ru ? 'Где вам легко понимать и поддерживать друг друга.' : 'Where understanding and supporting each other feels natural.'}</small>
                      </p>
                    </div>
                    <div className="compat-entry-disclosure-point">
                      <span aria-hidden="true" />
                      <p>
                        <strong>{ru ? 'Где можно не совпасть' : 'Where you may differ'}</strong>
                        <small>{ru ? 'Какие различия чаще вызывают напряжение или недопонимание.' : 'Which differences are more likely to create tension or misunderstanding.'}</small>
                      </p>
                    </div>
                    <div className="compat-entry-disclosure-point">
                      <span aria-hidden="true" />
                      <p>
                        <strong>{ru ? 'Как лучше договориться' : 'How to understand each other'}</strong>
                        <small>{ru ? 'Что поможет слышать друг друга и не повторять один и тот же спор.' : 'What helps you hear each other and avoid repeating the same argument.'}</small>
                      </p>
                    </div>
                  </div>
                  <p className="compat-entry-disclosure-note">
                    {ru ? 'Выбранная сфера задаёт контекст разбора.' : 'The selected area sets the context for the reading.'}
                  </p>
                </div>
              </details>

              <section className="compat-entry-context" aria-label={ru ? 'Тип отношений' : 'Relationship type'}>
                <RelationshipContextPicker
                  focus={relationshipFocus}
                  onChange={(focus, context) => {
                    setRelationshipFocus(focus);
                    setRelationshipContext(context);
                  }}
                  ru={ru}
                  compact
                />
              </section>

              <section className="compat-air-person compat-air-person--first" aria-labelledby="compat-first-person-title">
                <header className="compat-air-person-heading">
                  <div className="compat-air-person-title">
                    <h3 id="compat-first-person-title">{ru ? 'Первый человек' : 'First person'}</h3>
                  </div>
                  <PersonSourcePicker
                    value={subjectSource}
                    onChange={setSubjectSource}
                    ru={ru}
                  />
                </header>
                {ownSavedChart ? (
                  <button
                    type="button"
                    className="compat-use-own-chart"
                    onClick={() => {
                      lumiaSelectionHaptic();
                      setSubjectSource('saved');
                      setFirstChartId(ownSavedChart.id);
                    }}
                  >
                    <span>{ru ? 'Использовать мою карту' : 'Use my chart'}</span>
                    <small>{ownSavedChart.name}</small>
                  </button>
                ) : null}
                {subjectSource === 'birth' ? (
                  <PersonBirthFields
                    prefix="compat-first-person"
                    ru={ru}
                    name={sName}
                    date={sDate}
                    time={sTime}
                    place={sPlace}
                    gender={youGender}
                    timePrecision={sTimePrecision}
                    onNameChange={setSName}
                    onDateChange={(value) => {
                      setSDate(value);
                      const resolved = sunSignFromDate(value);
                      if (resolved) setYouSign(resolved);
                    }}
                    onTimeChange={setSTime}
                    onPlaceChange={setSPlace}
                    onGenderChange={setYouGender}
                    onTimePrecisionChange={setSTimePrecision}
                  />
                ) : subjectSource === 'saved' ? (
                  <PersonSavedFields
                    prefix="compat-first-person"
                    ru={ru}
                    charts={availableCharts}
                    value={firstChartId}
                    disabledChartId={partnerSource === 'saved' ? secondChartId : null}
                    gender={youGender}
                    onChange={setFirstChartId}
                    onGenderChange={setYouGender}
                    onOpenCharts={onOpenCharts}
                  />
                ) : (
                  <PersonSignFields
                    prefix="compat-first-person"
                    ru={ru}
                    language={profile.language}
                    sign={youSign}
                    gender={youGender}
                    onSignChange={setYouSign}
                    onGenderChange={setYouGender}
                  />
                )}
              </section>

              <div className="compat-person-divider" aria-hidden="true" />

              <section className="compat-air-person compat-air-person--second" aria-labelledby="compat-second-person-title">
                <header className="compat-air-person-heading">
                  <div className="compat-air-person-title">
                    <h3 id="compat-second-person-title">{ru ? 'Второй человек' : 'Second person'}</h3>
                  </div>
                  <PersonSourcePicker
                    value={partnerSource}
                    onChange={setPartnerSource}
                    ru={ru}
                  />
                </header>
                {partnerSource === 'birth' ? (
                  <PersonBirthFields
                    prefix="compat-second-person"
                    ru={ru}
                    name={fName}
                    date={fDate}
                    time={fTime}
                    place={fPlace}
                    gender={fGender}
                    timePrecision={fTimePrecision}
                    onNameChange={setFName}
                    onDateChange={(value) => {
                      setFDate(value);
                      const resolved = sunSignFromDate(value);
                      if (resolved) setPickSign(resolved);
                    }}
                    onTimeChange={setFTime}
                    onPlaceChange={setFPlace}
                    onGenderChange={setFGender}
                    onTimePrecisionChange={setFTimePrecision}
                  />
                ) : partnerSource === 'saved' ? (
                  <PersonSavedFields
                    prefix="compat-second-person"
                    ru={ru}
                    charts={availableCharts}
                    value={secondChartId}
                    disabledChartId={subjectSource === 'saved' ? firstChartId : null}
                    gender={fGender}
                    onChange={setSecondChartId}
                    onGenderChange={setFGender}
                    onOpenCharts={onOpenCharts}
                  />
                ) : (
                  <PersonSignFields
                    prefix="compat-second-person"
                    ru={ru}
                    language={profile.language}
                    sign={pickSign}
                    gender={fGender}
                    onSignChange={setPickSign}
                    onGenderChange={setFGender}
                  />
                )}
              </section>

              {error ? <p className="compat-entry-error" role="alert">{error}</p> : null}

              <button type="submit" className="fresh-btn-primary compat-entry-submit">
                {ru ? 'Сравнить' : 'Compare'}
              </button>
            </form>

            {history.length ? (
              <details className="compat-history-panel">
                <summary>{ru ? 'История сравнений' : 'Comparison history'}</summary>
                <div className="compat-history-toolbar">
                  <button type="button" onClick={deleteAllHistory}>{ru ? 'Очистить историю' : 'Clear history'}</button>
                </div>
                <div className="compat-hist">
                  {history.map((entry) => (
                    <div key={entry.id} className="compat-hist-row" role="button" tabIndex={0} onClick={() => openFromHistory(entry)} onKeyDown={(event) => { if (event.key === 'Enter') openFromHistory(entry); }}>
                      <span className="compat-hist-ico"><ZodiacIcon sign={entry.theirSun} size={20} strokeWidth={1.5} /></span>
                      <span className="compat-hist-main">
                        <span className="compat-hist-name">
                          {entry.subjectName || profile.name || (ru ? 'Первая карта' : 'First chart')}
                          {' + '}
                          {entry.name || (ru ? 'Вторая карта' : 'Second chart')}
                        </span>
                        <span className="compat-hist-sub">{getZodiacSign(lang, entry.theirSun)} · {getRelationshipContextLabel(normalizeRelationshipContext(entry.relationshipContext), lang)}</span>
                      </span>
                      <span className="compat-hist-open" aria-hidden="true"><ChevronRightIcon size={17} /></span>
                      <button type="button" className="compat-hist-del" aria-label={ru ? 'Удалить' : 'Delete'} onClick={(event) => deleteHistory(entry.id, event)}>
                        <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><path d="M3.5 3.5l7 7M10.5 3.5l-7 7" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" /></svg>
                      </button>
                    </div>
                  ))}
                </div>
              </details>
            ) : null}
          </>
        ) : (
          <form
            className="compat-sign-form"
            onSubmit={(event) => {
              event.preventDefault();
              openResult({
                kind: 'sign',
                relationshipContext,
                sign: pickSign,
                subjectSign: youSign,
                partnerSign: pickSign,
                calculationLevel: 'sign_only',
                youSign,
                youGender,
                themGender,
              });
            }}
          >
            <h2 className="compat-entry-who-title">
              {ru ? 'Кого сравниваем?' : 'Who are we comparing?'}
            </h2>
            <SignSwipePicker
              label={ru ? 'Первый человек' : 'First person'}
              signs={ZODIAC_KEYS}
              active={youSign}
              language={profile.language}
              onPick={(sign) => { lumiaSelectionHaptic(); setYouSign(sign); }}
            />

            <div className="compat-person-divider compat-person-divider--signs" aria-hidden="true"><span>+</span></div>

            <SignSwipePicker
              label={ru ? 'Второй человек' : 'Second person'}
              signs={ZODIAC_KEYS}
              active={pickSign}
              language={profile.language}
              onPick={(sign) => { lumiaSelectionHaptic(); setPickSign(sign); }}
            />

            <section className="compat-entry-context" aria-labelledby="compat-sign-context-title">
              <h2 id="compat-sign-context-title">{ru ? 'Тип отношений' : 'Relationship type'}</h2>
              <RelationshipContextPicker
                focus={relationshipFocus}
                onChange={(focus, context) => {
                  setRelationshipFocus(focus);
                  setRelationshipContext(context);
                }}
                ru={ru}
                compact
              />
            </section>

            <button type="submit" className="fresh-btn-primary compat-entry-submit">
              {ru ? 'Сравнить' : 'Compare'}
            </button>
            <p className="compat-entry-note compat-entry-note--centered">
              {ru
                ? 'Для подробного разбора нужны дата, время и место рождения.'
                : 'A detailed reading needs the birth date, time and place.'}
            </p>
          </form>
        )}

        <div style={{ height: 'calc(env(safe-area-inset-bottom, 0px) + 24px)' }} />
      </div>
    );
  }

  /* ── РЕЗУЛЬТАТ ── */
  const strongestLabel = score ? DIMENSION_LABELS[score.strongest][lang] : '';
  const dimsOrder: CompatDimension[] = ['love', 'relationship', 'friendship', 'work'];
  const isPerson = selected?.kind === 'person';
  const resultContext = selected?.relationshipContext || relationshipContext;
  const resultContextLabel = getRelationshipContextLabel(resultContext, lang);
  const resultTitles = readingTitles(resultContext, ru);
  const resultDeepTitles = deepReadingTitles(resultContext, ru);
  const leftName = selected?.kind === 'sign'
    ? getZodiacSign(lang, leftSun)
    : (selected?.subjectName || profile.name || (ru ? 'Первая карта' : 'First chart'));
  const rightName = selected?.kind === 'sign'
    ? getZodiacSign(lang, theirSun)
    : theirName;
  const leftBirthDate = selected?.subjectDate || profile.birthDate;
  const leftDetail = selected?.kind === 'sign'
    ? (ru ? 'Первый знак' : 'First sign')
    : leftBirthDate
      ? `${genderWord(leftGender, ru)} — ${formatDisplayDate(leftBirthDate, lang)}`
      : `${genderWord(leftGender, ru)} · ${getZodiacSign(lang, leftSun)}`;
  const rightDetail = selected?.date
    ? `${selected.kind === 'sign' ? '' : `${genderWord(rightGender, ru)} — `}${formatDisplayDate(selected.date, lang)}`
    : selected?.kind === 'sign'
      ? (ru ? 'Второй знак' : 'Second sign')
      : `${genderWord(rightGender, ru)} · ${getZodiacSign(lang, theirSun)}`;
  const signReadingBlocks = selected?.kind === 'sign' && signText
    ? [
        { title: resultTitles[0], text: String(signText.attraction || '') },
        { title: resultTitles[1], text: String(signText.difficulty || '') },
        { title: resultTitles[2], text: String(signText.communication || '') },
      ].filter((block) => block.text.trim().length > 0)
    : [];
  const resultPercent = selected?.kind === 'person'
    ? typeof deep?.overallScore === 'number'
      ? Math.round(deep.overallScore)
      : typeof deep?.compatibilityScore === 'number'
        ? Math.round(deep.compatibilityScore)
      : null
    : typeof score?.overall === 'number'
      ? Math.round(score.overall)
      : null;
  const resultVerdict = isPerson ? deep?.verdict : score?.verdict;
  const signReactionKey = selected?.kind === 'sign'
    ? buildSignCompatibilityReactionKey({
        subjectSign: leftSun,
        partnerSign: theirSun,
        subjectGender: leftGender,
        partnerGender: rightGender,
        relationshipContext: selected.relationshipContext,
        language: lang,
      })
    : null;
  const resultReactionKey = isPerson ? deepReactionKey : signReactionKey;
  const ringGeometry = resultPercent == null ? null : getCompatibilityRingGeometry(resultPercent);
  const ringStyle = ringGeometry
    ? { '--compat-ring-offset': `${ringGeometry.centerOffset}px` } as React.CSSProperties
    : undefined;
  const deepSections = deep?.sections?.length
    ? deep.sections
    : deep
      ? [
          { id: 'connection', title: resultDeepTitles[1], text: deep.fullAnalysis?.attraction || '', evidenceIds: [] },
          { id: 'difficulties', title: resultDeepTitles[2], text: deep.fullAnalysis?.difficulties || '', evidenceIds: [] },
          { id: 'potential', title: resultDeepTitles[3], text: deep.fullAnalysis?.potential || '', evidenceIds: [] },
        ].filter((section) => section.text.trim())
      : [];
  const readingIntroTitle = deep?.calculationLevel === 'full'
    ? (ru ? 'Подробный разбор по двум натальным картам' : 'Detailed reading from two natal charts')
    : deep
      ? (ru ? 'Разбор без полного времени рождения' : 'Reading without complete birth times')
      : '';
  const isWaitingForResult = isPerson
    ? Boolean(deepLoading && !deep && !error)
    : Boolean(!signText && !error);

  return (
    <div className="fresh-page compat-editorial-page compat-editorial-page--result" aria-busy={isWaitingForResult}>
      {compatibilityHeader(true)}

      <header className="compat-result-heading">
        <MeouLogo className="compat-result-brand" fullCloud />
        <span className="compat-result-brand-caption">
          {ru ? 'Сравниваем совместимость двух человек' : 'Comparing two people’s compatibility'}
        </span>
      </header>

      {resultPercent != null ? (
        <section
          key={`${resultContext}:${resultPercent}`}
          className="compat-result-score"
        >
          <div className="compat-result-ring-people" aria-label={ru ? 'Участники сравнения' : 'Compared people'}>
            <span className="is-left">
              <i aria-hidden="true" />
              <strong>{leftName}</strong>
              <small>{leftDetail}</small>
              <small className="compat-result-person-zodiac">{getZodiacSign(lang, leftSun)}</small>
            </span>
            <span className="is-right">
              <i aria-hidden="true" />
              <strong>{rightName}</strong>
              <small>{rightDetail}</small>
              <small className="compat-result-person-zodiac">{getZodiacSign(lang, theirSun)}</small>
            </span>
          </div>
          <div
            className="compat-result-orbit"
            style={ringStyle}
            role="img"
            aria-label={ru ? `${leftName} и ${rightName}: индекс совместимости ${resultPercent} из 100` : `${leftName} and ${rightName}: compatibility index ${resultPercent} out of 100`}
          >
            <span className="compat-result-orbit-circle is-left" aria-hidden="true" />
            <span className="compat-result-orbit-circle is-right" aria-hidden="true" />
            <span className="compat-result-orbit-center">
              <strong>{resultPercent}%</strong>
              <small>{ru ? 'индекс связи' : 'connection index'}</small>
            </span>
          </div>
          {resultVerdict ? <p>{resultVerdict}</p> : null}
        </section>
      ) : null}

      {isPerson && deep?.evidence?.length ? (
        <details className="compat-technical-data compat-technical-data--deep compat-technical-data--near-score">
          <summary>
            <span className="compat-calculation-heading">
              <strong>{ru ? 'Почему так?' : 'Why this result?'}</strong>
              <small>
                {ru
                  ? 'Большие кольца показывают общий индекс — среднее с учётом важности всех сфер ниже. Чем выше процент, тем ближе кольца.'
                  : 'The large rings show the overall index — an average weighted by the importance of every area below. A higher score brings the rings closer.'}
              </small>
            </span>
          </summary>
          <div className="compat-calculation-details">
            <div className="compat-score-list" aria-label={ru ? 'Оценки по темам' : 'Dimension scores'}>
              {(deep.dimensions || []).map((dimension) => (
                <div key={dimension.id}>
                  <span>{dimension.label}</span>
                  <strong>{dimension.score}%</strong>
                </div>
              ))}
            </div>
            <ul className="compat-evidence-list">
              {deep.evidence.slice(0, 8).map((item) => <li key={item.id}>{item.label}</li>)}
            </ul>
          </div>
        </details>
      ) : null}

      {!isPerson && score ? (
        <details className="compat-technical-data compat-technical-data--near-score">
          <summary>
            <span className="compat-calculation-heading">
              <strong>{ru ? 'Почему так?' : 'Why this result?'}</strong>
              <small>
                {ru
                  ? 'Большие кольца показывают общий индекс — среднее по всем сферам ниже. Чем выше процент, тем ближе кольца.'
                  : 'The large rings show the overall index — the average across every area below. A higher score brings the rings closer.'}
              </small>
            </span>
          </summary>
          <div className="compat-score-list" aria-label={ru ? 'Оценки по сферам' : 'Scores by area'}>
            {dimsOrder.map((key) => (
              <div key={key} className={key === score.strongest ? 'is-strongest' : ''}>
                <span>{DIMENSION_LABELS[key][lang]}</span>
                <strong>{score.dims[key]}%</strong>
              </div>
            ))}
          </div>
        </details>
      ) : null}

      {resultPercent == null ? (
        <div className="compat-result-waiting-pair">
          <strong>{leftName} + {rightName}</strong>
          <span>{leftDetail} · {rightDetail}</span>
        </div>
      ) : null}

      {isPerson && deep ? (
        <section className="compat-result-summary">
          <span>{ru ? 'Общий вывод' : 'Overview'}</span>
          <EditorialProse text={deep.summary} />
        </section>
      ) : !isPerson && score ? (
        <section className="compat-result-summary compat-result-summary--sign">
          <span>{ru ? 'Общий результат' : 'Overall result'}</span>
          <h2>{score.verdict}</h2>
          <p><strong>{ru ? 'Сильнее всего:' : 'Strongest:'}</strong> {strongestLabel}</p>
        </section>
      ) : null}

      <div className="compat-result-meta">
        <span>{ru ? 'Смотрим' : 'Context'} · <strong>{resultContextLabel}</strong></span>
        <button
          type="button"
          className="compat-result-change"
          onClick={() => {
            lumiaSelectionHaptic();
            setError(null);
            setEntryMode(selected?.kind === 'sign' ? 'sign' : 'birth');
            setScreen('add');
            scrollCompatibilityToTop();
          }}
        >
          {selected?.kind === 'sign'
            ? (ru ? 'Изменить знаки' : 'Change signs')
            : (ru ? 'Изменить людей' : 'Change people')}
        </button>
      </div>

      {isPerson && deep?.dimensions?.length ? (
        <section className="compat-dimension-highlights" aria-label={ru ? 'Главные темы расчёта' : 'Main calculated themes'}>
          <div>
            <span>{ru ? 'Сильнее всего' : 'Strongest'}</span>
            <strong>{(deep.strongestDimensions || []).map((dimension) => dimension.label).join(' · ') || '—'}</strong>
          </div>
          <div>
            <span>{ru ? 'Требует внимания' : 'Needs attention'}</span>
            <strong>{(deep.challengingDimensions || []).map((dimension) => dimension.label).join(' · ') || '—'}</strong>
          </div>
        </section>
      ) : null}

      {isPerson && deep ? (
        <div className="compat-reading-intro">
          <strong>{readingIntroTitle}</strong>
          {deep?.limitations?.[0] ? <span>{deep.limitations[0]}</span> : null}
        </div>
      ) : null}

      {isWaitingForResult ? (
        <section className="compat-result-status" role="status" aria-live="polite">
          <span className="compat-result-status-mark" aria-hidden="true" />
          <div>
            <strong>{isPerson ? (ru ? 'Сопоставляем две карты' : 'Comparing two charts') : (ru ? 'Сравниваем знаки' : 'Comparing signs')}</strong>
            <p>{isPerson ? (ru ? 'Готовим подробный разбор…' : 'Preparing the detailed reading…') : (ru ? 'Готовим результат…' : 'Preparing the result…')}</p>
          </div>
        </section>
      ) : null}

      {error ? (
        <section className="compat-result-error" role="alert">
          <p>{error}</p>
          {isPerson && premium ? (
            <button type="button" onClick={() => void runDeep()}>
              {ru ? 'Повторить расчёт' : 'Try again'}
            </button>
          ) : null}
        </section>
      ) : null}

      {signReadingBlocks.length ? (
        <div className="compat-read">
          {signReadingBlocks.map((block, index) => (
            <CompatBlock key={`${block.title}-${index}`} title={block.title} index={index} reduce={reduce}>{block.text}</CompatBlock>
          ))}
        </div>
      ) : null}

      {premium && deep ? (
        <div className="compat-read compat-read--deep">
          {deepSections.map((section, index) => (
            <CompatBlock key={section.id} title={section.title} index={index} reduce={reduce}>{section.text}</CompatBlock>
          ))}
          {deep.closing ? (
            <section className="compat-final-payoff" aria-labelledby="compat-final-payoff-title">
              <span>{ru ? 'Финальный вывод' : 'Final reading'}</span>
              <h2 id="compat-final-payoff-title">{ru ? 'Главное о вашей связи' : 'What matters most about your bond'}</h2>
              <dl>
                <div>
                  <dt>{ru ? 'Сила' : 'Strength'}</dt>
                  <dd>{deep.closing.strength}</dd>
                </div>
                <div>
                  <dt>{ru ? 'Слабое место' : 'Weak point'}</dt>
                  <dd>{deep.closing.risk}</dd>
                </div>
                <div>
                  <dt>{ru ? 'Что помогает' : 'What helps'}</dt>
                  <dd>{deep.closing.action}</dd>
                </div>
              </dl>
            </section>
          ) : null}
        </div>
      ) : isPerson && !deepLoading && !error && (premium || canPromotePremium) ? (
        <button type="button" className="horo-premium" style={{ marginTop: 16 }} disabled={deepLoading} onClick={() => void runDeep()}>
          <div className="horo-premium-text">
            <div className="horo-premium-kicker">{ru ? 'Подробная совместимость' : 'Detailed compatibility'}</div>
            <div className="horo-premium-title">
              {deepLoading ? (ru ? 'Сопоставляю данные…' : 'Comparing the data…') : !premium ? (ru ? 'Глубокий разбор — в Premium' : 'Deep reading — Premium') : (ru ? 'Открыть подробный разбор' : 'Open detailed reading')}
            </div>
          </div>
          <span className="horo-premium-cta">{!premium ? 'Premium' : (ru ? 'Открыть' : 'Open')}<ChevronRightIcon size={15} /></span>
        </button>
      ) : !isPerson && (premium || canPromotePremium) ? (
        <button type="button" className="horo-premium" style={{ marginTop: 16 }} onClick={() => {
          lumiaSelectionHaptic();
          if (!premium) {
            void requestPremium('compatibility_by_charts', {
              placement: 'compatibility_by_charts',
              featureKey: 'synastry_by_charts',
              triggerType: 'locked_feature',
              returnView: 'synastry',
              returnAction: 'open_birth_compatibility',
            });
            return;
          }
          setEntryMode('birth');
          setScreen('add');
        }}>
          <div className="horo-premium-text">
            <div className="horo-premium-kicker">Premium</div>
            <div className="horo-premium-title">{ru ? 'Подробное сравнение по двум натальным картам' : 'Detailed comparison from two natal charts'}</div>
          </div>
          <span className="horo-premium-cta">{premium ? (ru ? 'Открыть' : 'Open') : 'Premium'}<ChevronRightIcon size={15} /></span>
        </button>
      ) : null}

      {(!isPerson || deep) && resultReactionKey ? (
        <div className="compat-result-actions">
          <ContentActivityBar
            userId={!previewEnabled && profile.id ? String(profile.id) : undefined}
            surface="compatibility"
            contentKey={resultReactionKey}
            language={lang}
            onShare={shareCompat}
            showLabels
            showCounts={false}
            className="compat-result-activity"
          />
        </div>
      ) : null}

      <div style={{ height: 'calc(env(safe-area-inset-bottom, 0px) + 24px)' }} />
    </div>
  );
}
