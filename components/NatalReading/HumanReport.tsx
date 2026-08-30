import React, { useEffect, useMemo, useRef, useState } from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import { ChevronDown, Crown, Send } from 'lucide-react';
import type {
  InterpretationSection,
  NatalChartData,
  UserProfile,
} from '../../types';
import {
  HUMAN_PAID_SECTION_META,
  type HumanPaidSectionKey,
} from '../../lib/natalHumanShared';
import {
  askNatalQuestion,
  ensureHumanBaseReport,
  ensureHumanPremiumReport,
  getHumanBaseReportCached,
  getHumanPremiumReportCached,
  loadNatalQuestionSnapshot,
  type HumanReadingError,
} from '../../services/natalReadingService';
import { hasActivePremium } from '../../lib/accessMatrix';
import {
  NATAL_PERMANENT_CONTRACT_VERSION,
  buildPermanentNatalChartFingerprint,
  buildNatalModelContext,
  getPermanentNatalReliability,
  isNatalPermanentFreeReport,
  type NatalEvidenceFact,
  type NatalPermanentFreeReport,
  type NatalPermanentPremiumReport,
  type NatalReadingStatement,
} from '../../lib/natalReading/permanentReport';
import type { NatalQuestionSnapshot } from '../../lib/natalReading/natalQuestion';
import type { NatalQuestionStoredMessage } from '../../lib/natalReading/natalQuestionStore';
import type { ChartListItem } from '../../services/storageService';
import { PlanetIcon } from '../icons/PlanetIcon';
import { FormattedAiText } from '../ui/FormattedAiText';
import { MONO_EASE } from '../mono-ui/motion';
import { CosmicSheet } from '../lumia-ui/CosmicSheet';
import type { PaywallContext } from '../../lib/paywallContext';
import { normalizePersonalForecastQuestionInput } from '../../lib/personalForecastQuestionModeration';

export type PreloadedNatalReport = {
  report: NatalPermanentFreeReport;
  chartFingerprint: string;
  reportVersion: string;
};

type Props = {
  profile: UserProfile;
  chartData: NatalChartData;
  chartId?: number;
  chartSubject?: ChartListItem | null;
  requestPremium: (source?: string, payload?: Record<string, unknown>) => void | Promise<void>;
  onUpdateProfile?: (profile: UserProfile) => void;
  preloadedReport?: PreloadedNatalReport | null;
  /** Шапку (имя/дата/интро) рисует родитель (NatalMagazine) — не дублируем. */
  hideIntro?: boolean;
  premiumContinuation?: PaywallContext | null;
  onPremiumContinuationHandled?: (paywallInstanceId: string) => void;
  canPromotePremium?: boolean;
  onOpenQuestions?: () => void;
  surface?: 'reading' | 'questions';
  uiPreview?: {
    state?: 'ready' | 'loading' | 'error';
    premiumReport?: NatalPermanentPremiumReport | null;
  };
};

const SIGN_RU: Record<string, string> = {
  Aries: 'Овен', Taurus: 'Телец', Gemini: 'Близнецы', Cancer: 'Рак',
  Leo: 'Лев', Virgo: 'Дева', Libra: 'Весы', Scorpio: 'Скорпион',
  Sagittarius: 'Стрелец', Capricorn: 'Козерог', Aquarius: 'Водолей', Pisces: 'Рыбы',
};

const PLANET_LABELS: Array<{ key: string; labelRu: string; labelEn: string; icon: string }> = [
  { key: 'sun', labelRu: 'Солнце', labelEn: 'Sun', icon: 'sun' },
  { key: 'moon', labelRu: 'Луна', labelEn: 'Moon', icon: 'moon' },
  { key: 'mercury', labelRu: 'Меркурий', labelEn: 'Mercury', icon: 'mercury' },
  { key: 'venus', labelRu: 'Венера', labelEn: 'Venus', icon: 'venus' },
  { key: 'mars', labelRu: 'Марс', labelEn: 'Mars', icon: 'mars' },
  { key: 'jupiter', labelRu: 'Юпитер', labelEn: 'Jupiter', icon: 'jupiter' },
  { key: 'saturn', labelRu: 'Сатурн', labelEn: 'Saturn', icon: 'saturn' },
  { key: 'uranus', labelRu: 'Уран', labelEn: 'Uranus', icon: 'uranus' },
  { key: 'neptune', labelRu: 'Нептун', labelEn: 'Neptune', icon: 'neptune' },
  { key: 'pluto', labelRu: 'Плутон', labelEn: 'Pluto', icon: 'pluto' },
  { key: 'chiron', labelRu: 'Хирон', labelEn: 'Chiron', icon: 'chiron' },
  { key: 'northNode', labelRu: 'Северный узел', labelEn: 'North Node', icon: 'north-node' },
  { key: 'southNode', labelRu: 'Южный узел', labelEn: 'South Node', icon: 'south-node' },
  { key: 'rising', labelRu: 'Асцендент', labelEn: 'Ascendant', icon: 'asc' },
  { key: 'mc', labelRu: 'MC', labelEn: 'MC', icon: 'mc' },
];

const NATAL_QUESTION_STARTERS = [
  {
    ru: 'Почему мне трудно просить о помощи?',
    en: 'Why is it hard for me to ask for help?',
  },
  {
    ru: 'Как я обычно принимаю важные решения?',
    en: 'How do I usually make important decisions?',
  },
  {
    ru: 'Что помогает мне не теряться в конфликте?',
    en: 'What helps me stay grounded in a conflict?',
  },
  {
    ru: 'Какие мои сильные стороны заметны в работе?',
    en: 'Which of my strengths show up at work?',
  },
  {
    ru: 'Как я веду себя в близких отношениях?',
    en: 'How do I tend to behave in close relationships?',
  },
  {
    ru: 'Что моя карта говорит о моём отношении к деньгам?',
    en: 'What does my chart say about my relationship with money?',
  },
] as const;

const ANGLE_NAMES = /^(?:ascendant|asc|rising|mc|midheaven|descendant|desc|dsc|ic)$/iu;
const ANGLE_ALIAS: Record<string, 'ascendant' | 'mc' | 'descendant' | 'ic'> = {
  ascendant: 'ascendant', asc: 'ascendant', rising: 'ascendant', mc: 'mc',
  midheaven: 'mc', descendant: 'descendant', desc: 'descendant', dsc: 'descendant', ic: 'ic',
};

function normalizedAngleKey(value: unknown): 'ascendant' | 'mc' | 'descendant' | 'ic' | null {
  return ANGLE_ALIAS[String(value || '').trim().toLocaleLowerCase('en-US')] || null;
}

function aspectUsesAngle(aspect: Record<string, unknown>): boolean {
  return ANGLE_NAMES.test(String(aspect.fromKey || aspect.from || '').trim())
    || ANGLE_NAMES.test(String(aspect.toKey || aspect.to || '').trim());
}

function ruSign(sign?: string | null): string {
  const value = String(sign || '').trim();
  return SIGN_RU[value] || value || 'знак не определен';
}

function fmtDegree(value?: number | null): string {
  return typeof value === 'number' && Number.isFinite(value)
    ? `${Number(value.toFixed(2))}°`
    : '';
}

function formatError(error: unknown): string {
  const value = error as HumanReadingError;
  if (value?.code === 'PREMIUM_REQUIRED') return 'Этот раздел доступен в Premium.';
  if (value?.code === 'NATAL_QUESTION_DAILY_LIMIT') return 'Лимит вопросов на сегодня исчерпан.';
  return value?.message || 'Не удалось загрузить разбор.';
}

function formatQuestionError(error: unknown, language: 'ru' | 'en'): string {
  const value = error as HumanReadingError;
  if (value?.code === 'PREMIUM_REQUIRED') {
    return language === 'ru'
      ? 'Вопросы по карте доступны в Premium.'
      : 'Questions about the chart are available with Premium.';
  }
  if (value?.code === 'NATAL_QUESTION_DAILY_LIMIT') {
    return language === 'ru'
      ? 'На сегодня вопросы закончились. Можно вернуться завтра.'
      : 'You have used today\'s questions. You can return tomorrow.';
  }
  if (value?.code === 'NATAL_QUESTION_CHART_REQUIRED') {
    return language === 'ru'
      ? 'Сначала сохрани натальную карту, затем задай вопрос.'
      : 'Save the natal chart before asking a question.';
  }
  if (value?.code === 'NATAL_QUESTION_REJECTED') {
    return language === 'ru'
      ? 'Здесь можно задать только конкретный вопрос о себе по сохранённой натальной карте. Выбери пример или уточни вопрос.'
      : 'Only specific questions about you can be answered from your saved natal chart. Choose an example or make the question more specific.';
  }
  if (value?.code === 'NATAL_QUESTION_SELF_CHART_REQUIRED') {
    return language === 'ru'
      ? '«Спросить о себе» работает только с твоей основной натальной картой.'
      : 'Ask about yourself works only with your own primary natal chart.';
  }
  if (
    value?.code === 'NATAL_QUESTION_GENERATION_FAILED'
    || value?.code === 'NATAL_QUESTION_VALIDATION_FAILED'
    || value?.code === 'NATAL_QUESTION_REQUEST_FAILED'
    || value?.code === 'CONTENT_GENERATION_TIMEOUT'
  ) {
    return language === 'ru'
      ? 'Не удалось подготовить ответ по карте. Попробуй отправить вопрос ещё раз.'
      : 'Unable to prepare an answer from the chart. Please submit the question again.';
  }
  return language === 'ru'
    ? 'Не удалось загрузить ответы. Проверь соединение и попробуй ещё раз.'
    : 'Unable to load the answers. Check your connection and try again.';
}

type NatalEvidenceMap = ReadonlyMap<string, NatalEvidenceFact>;

const ASPECT_LABELS: Record<string, { ru: string; en: string }> = {
  conjunction: { ru: 'соединение', en: 'conjunction' },
  sextile: { ru: 'секстиль', en: 'sextile' },
  square: { ru: 'квадрат', en: 'square' },
  trine: { ru: 'трин', en: 'trine' },
  opposition: { ru: 'оппозиция', en: 'opposition' },
};

const ANGLE_LABELS: Record<string, { ru: string; en: string }> = {
  ascendant: { ru: 'Асцендент', en: 'Ascendant' },
  asc: { ru: 'Асцендент', en: 'Ascendant' },
  rising: { ru: 'Асцендент', en: 'Ascendant' },
  mc: { ru: 'MC', en: 'MC' },
  midheaven: { ru: 'MC', en: 'MC' },
  descendant: { ru: 'Десцендент', en: 'Descendant' },
  desc: { ru: 'Десцендент', en: 'Descendant' },
  dsc: { ru: 'Десцендент', en: 'Descendant' },
  ic: { ru: 'IC', en: 'IC' },
};

function evidenceObjectLabel(value: unknown, language: 'ru' | 'en'): string {
  const raw = String(value || '').trim();
  const normalized = raw.replace(/[\s_-]+/g, '').toLocaleLowerCase('en-US');
  const planet = PLANET_LABELS.find((item) => (
    item.key.toLocaleLowerCase('en-US') === normalized
    || item.labelEn.replace(/\s+/g, '').toLocaleLowerCase('en-US') === normalized
  ));
  if (planet) return language === 'ru' ? planet.labelRu : planet.labelEn;
  const angle = ANGLE_LABELS[raw.toLocaleLowerCase('en-US')];
  return angle?.[language] || raw;
}

function evidenceSignLabel(value: unknown, language: 'ru' | 'en'): string {
  const sign = String(value || '').trim();
  if (language !== 'ru') return sign;
  const canonical = Object.keys(SIGN_RU).find((item) => item.toLocaleLowerCase('en-US') === sign.toLocaleLowerCase('en-US'));
  return canonical ? SIGN_RU[canonical] : ruSign(sign);
}

function evidenceDegree(value: unknown): string {
  if (value == null || value === '') return '';
  const number = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(number) ? `${Number(number.toFixed(2))}°` : '';
}

function evidenceHouse(value: unknown): number | null {
  if (value == null || value === '') return null;
  const number = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(number) && number > 0 ? number : null;
}

function formatNatalEvidence(fact: NatalEvidenceFact, language: 'ru' | 'en'): string {
  const data = fact.data;
  if (fact.kind === 'quality') {
    const quality = String(data.birthTimeQuality || 'unknown');
    if (language === 'ru') {
      return quality === 'exact'
        ? 'Время рождения точное'
        : quality === 'approximate'
          ? 'Время рождения приблизительное'
          : 'Время рождения неизвестно';
    }
    return quality === 'exact'
      ? 'Exact birth time'
      : quality === 'approximate'
        ? 'Approximate birth time'
        : 'Unknown birth time';
  }

  if (fact.kind === 'placement' || fact.kind === 'angle') {
    const object = evidenceObjectLabel(data.key || data.object || fact.object, language);
    const sign = evidenceSignLabel(data.sign, language);
    const degree = evidenceDegree(data.degree);
    const house = evidenceHouse(data.house);
    const retrograde = data.retrograde === true
      ? (language === 'ru' ? 'ретроградный' : 'retrograde')
      : '';
    return [
      `${object}${sign ? ` ${language === 'ru' ? 'в' : 'in'} ${sign}` : ''}${degree ? `, ${degree}` : ''}`,
      house != null ? `${house} ${language === 'ru' ? 'дом' : 'house'}` : '',
      retrograde,
    ].filter(Boolean).join(' · ');
  }

  if (fact.kind === 'aspect') {
    const from = evidenceObjectLabel(data.fromKey || data.from, language);
    const to = evidenceObjectLabel(data.toKey || data.to, language);
    const aspectKey = String(data.type || '').toLocaleLowerCase('en-US');
    const aspect = ASPECT_LABELS[aspectKey]?.[language] || String(data.type || '').trim();
    const orb = evidenceDegree(data.orb);
    const phaseKey = String(data.phase || '').toLocaleLowerCase('en-US');
    const phase = phaseKey === 'applying'
      ? (language === 'ru' ? 'сходящийся' : 'applying')
      : phaseKey === 'separating'
        ? (language === 'ru' ? 'расходящийся' : 'separating')
        : phaseKey === 'exact'
          ? (language === 'ru' ? 'точный' : 'exact')
          : '';
    return [
      [from, aspect, to].filter(Boolean).join(' '),
      orb ? `${language === 'ru' ? 'орб' : 'orb'} ${orb}` : '',
      phase,
    ].filter(Boolean).join(' · ');
  }

  if (fact.kind === 'house') {
    const house = evidenceHouse(data.house);
    const sign = evidenceSignLabel(data.sign, language);
    const degree = evidenceDegree(data.degree);
    return [
      house != null ? `${house} ${language === 'ru' ? 'дом' : 'house'}` : '',
      sign,
      degree,
    ].filter(Boolean).join(' · ');
  }

  return evidenceObjectLabel(fact.object, language);
}

const NatalEvidenceDetails: React.FC<{
  evidenceIds: string[] | undefined;
  evidenceById: NatalEvidenceMap;
  language: 'ru' | 'en';
  summary?: string;
}> = ({ evidenceIds, evidenceById, language, summary }) => {
  const labels = [...new Set((evidenceIds || [])
    .map((id) => evidenceById.get(id))
    .filter((fact): fact is NatalEvidenceFact => fact != null)
    .map((fact) => formatNatalEvidence(fact, language))
    .filter(Boolean))];
  if (!labels.length) return null;

  return (
    <details className="natal-evidence-disclosure">
      <summary>
        {summary || (language === 'ru' ? 'Как это связано с картой' : 'How this connects to the chart')}
      </summary>
      <ul
        className="natal-inline-evidence"
        aria-label={language === 'ru' ? 'Астрологические основания' : 'Astrological evidence'}
      >
        {labels.map((label) => <li key={label}>{label}</li>)}
      </ul>
    </details>
  );
};

function questionMessageEvidenceIds(message: NatalQuestionStoredMessage): string[] {
  const value = message.payload?.evidenceIds || message.payload?.evidence_ids;
  return Array.isArray(value)
    ? [...new Set(value.map((id) => String(id || '').trim()).filter(Boolean))]
    : [];
}

type NatalQuestionPair = {
  question: NatalQuestionStoredMessage;
  answer: NatalQuestionStoredMessage | null;
};

function buildNatalQuestionPairs(messages: readonly NatalQuestionStoredMessage[]): NatalQuestionPair[] {
  const answersByQuestionId = new Map<string, NatalQuestionStoredMessage>();
  for (const message of messages) {
    if (message.role !== 'assistant') continue;
    const questionId = String(message.payload?.questionMessageId || '').trim();
    if (questionId) answersByQuestionId.set(questionId, message);
  }
  return messages
    .filter((message) => message.role === 'user')
    .map((question) => ({
      question,
      answer: answersByQuestionId.get(String(question.id)) || null,
    }));
}

const SectionText: React.FC<{
  section: InterpretationSection;
  index?: number;
}> = ({ section, index = 0 }) => {
  const reduce = useReducedMotion();
  const Comp = reduce ? 'section' : motion.section;
  return (
    <Comp
      {...(!reduce
        ? {
            initial: { opacity: 0, y: 12 },
            whileInView: { opacity: 1, y: 0 },
            viewport: { once: true, margin: '-40px' },
            transition: {
              duration: 0.32,
              delay: Math.min(index * 0.04, 0.16),
              ease: MONO_EASE,
            },
          }
        : {})}
      data-reading-section-key={section.key}
      className="natal-sec editorial-reading-section"
    >
      {section.title ? <h2 className="natal-sec-title">{section.title}</h2> : null}
      <FormattedAiText
        text={section.content}
        className="natal-sec-body max-w-none"
        paragraphClassName="natal-sec-p"
      />
    </Comp>
  );
};

/** Compatibility paywall used by the existing story deck. */
export const NatalUnlockSheet: React.FC<{
  sectionKey: HumanPaidSectionKey;
  isLoading: boolean;
  onClose: () => void;
  onPremium: () => void;
}> = ({ sectionKey, isLoading, onClose, onPremium }) => {
  const meta = HUMAN_PAID_SECTION_META[sectionKey];
  return (
    <CosmicSheet
      open
      title={meta.title}
      subtitle="Полный раздел карты"
      closeLabel="Закрыть"
      onClose={onClose}
      footer={(
        <button
          type="button"
          onClick={onPremium}
          disabled={isLoading}
          className="flex w-full items-center justify-center gap-2 rounded-full bg-white px-5 py-3 text-[14px] font-semibold text-[#111827] disabled:opacity-60"
        >
          <Crown size={16} strokeWidth={2} />
          {isLoading ? 'Открываем...' : 'Получить Premium'}
        </button>
      )}
    >
      <p className="text-[14.5px] leading-relaxed text-white/82">{meta.teaser}</p>
      <p className="mt-3 text-[12.5px] leading-relaxed text-white/62">
        Полный доступ к подробному постоянному разбору карты — в Premium.
      </p>
    </CosmicSheet>
  );
};

export const TechnicalDetails: React.FC<{ chartData: NatalChartData; language: 'ru' | 'en' }> = ({
  chartData,
  language,
}) => {
  const reliability = getPermanentNatalReliability(chartData);
  const technicalProfile = {
    id: '',
    name: '',
    birthDate: '',
    birthTime: '',
    birthPlace: '',
    isSetup: true,
    isPremium: false,
    language,
    theme: 'light' as const,
  };
  const technicalEvidence = buildNatalModelContext(technicalProfile, chartData).context.evidence;
  const usablePlacementIds = new Set(
    technicalEvidence
      .filter((fact) => fact.kind === 'placement' && !!fact.data.sign)
      .map((fact) => fact.id),
  );
  const positions = chartData.positions as Record<string, any> | undefined;
  const chartQualityV2 = chartData.chartQuality as unknown as {
    stableHousePlacements?: string[];
    variableAngles?: string[];
    variableHouses?: number[];
    variableAspectIds?: string[];
  } | undefined;
  const stableHousePlacements = new Set(chartQualityV2?.stableHousePlacements || []);
  const variableAngles = new Set(chartQualityV2?.variableAngles || []);
  const variableHouses = new Set(chartQualityV2?.variableHouses || []);
  const variableAspectIds = new Set(chartQualityV2?.variableAspectIds || []);
  const reliableAngleKeys = new Set(
    Object.entries(chartData.angles || {})
      .filter(([key, value]: [string, any]) => (
        !!value?.sign
        && value.reliability !== 'variable_in_range'
        && (
          reliability.quality === 'exact'
          || (value.stableSign === true && !variableAngles.has(key as any))
        )
      ))
      .map(([key]) => normalizedAngleKey(key))
      .filter((key): key is 'ascendant' | 'mc' | 'descendant' | 'ic' => key != null),
  );
  if (
    !chartData.angles
    && reliability.quality === 'exact'
    && chartData.rising?.sign
  ) reliableAngleKeys.add('ascendant');
  if (!chartData.angles && reliability.quality === 'exact' && chartData.mc?.sign) reliableAngleKeys.add('mc');
  const planets = PLANET_LABELS.map((item) => {
    const isAngle = item.key === 'rising' || item.key === 'mc';
    const angleKey = item.key === 'rising' ? 'ascendant' : item.key;
    if (isAngle && !reliableAngleKeys.has(angleKey as 'ascendant' | 'mc')) return null;
    const position = item.key === 'rising'
      ? (chartData.angles?.ascendant || chartData.rising)
      : item.key === 'mc'
        ? (chartData.angles?.mc || chartData.mc)
        : positions?.[item.key] || (chartData as any)[item.key];
    if (!position?.sign) return null;
    if (!isAngle && !usablePlacementIds.has(`natal.position.${item.key}`)) return null;
    const showHouse = reliability.housesIncluded
      && (
        reliability.quality === 'exact'
        || position.stable?.house === true
        || stableHousePlacements.has(item.key as any)
      );
    return {
      ...item,
      label: language === 'ru' ? item.labelRu : item.labelEn,
      sign: language === 'ru' ? ruSign(position.sign) : String(position.sign),
      degree: reliability.quality === 'exact' || position.reliability === 'exact'
        ? fmtDegree(position.degree)
        : '',
      house: showHouse && position.house != null
        ? `${position.house} ${language === 'ru' ? 'дом' : 'house'}`
        : '',
      retrograde: position.retrograde === true
        && (reliability.quality === 'exact' || position.stable?.retrograde === true),
    };
  }).filter(Boolean);
  const aspects = (chartData.aspects || [])
    .filter((aspect: any) => {
      if (aspect?.reliable === false || variableAspectIds.has(String(aspect?.id || ''))) return false;
      if (!aspectUsesAngle(aspect)) return true;
      const from = normalizedAngleKey(aspect.fromKey || aspect.from);
      const to = normalizedAngleKey(aspect.toKey || aspect.to);
      return (!from || reliableAngleKeys.has(from)) && (!to || reliableAngleKeys.has(to));
    })
    .map((aspect: any) => ({
      id: String(aspect.id || `${aspect.fromKey || aspect.from}-${aspect.type}-${aspect.toKey || aspect.to}`),
      from: String(aspect.from || aspect.fromKey || ''),
      to: String(aspect.to || aspect.toKey || ''),
      type: String(aspect.type || ''),
      orb: typeof aspect.orb === 'number' && Number.isFinite(aspect.orb)
        ? `${aspect.orb.toFixed(2)}°`
        : '',
      phase: String(aspect.phase || ''),
    }));
  const houses = reliability.housesIncluded
    ? (chartData.houses || []).filter((house: any, index) => {
        const number = Number(house?.house) || index + 1;
        return house?.reliability !== 'variable_in_range'
          && (
            reliability.quality === 'exact'
            || (house?.stableSign === true && !variableHouses.has(number))
          );
      })
    : [];

  return (
    <details className="natal-technical-details border-t border-[#eeeeee] py-6">
      <summary className="flex cursor-pointer list-none items-center justify-between text-[13px] font-medium text-[#3a3a3a]">
        <span>{language === 'ru' ? 'Как это видно в карте' : 'How this appears in the chart'}</span>
        <ChevronDown size={16} strokeWidth={1.7} />
      </summary>
      <p className="mt-3 text-[12.5px] leading-relaxed text-[#777]">
        {language === 'ru'
          ? 'Здесь собраны все рассчитанные положения и связи карты.'
          : 'This section contains all calculated placements and connections in the chart.'}
      </p>
      <ul className="mt-4 divide-y divide-[#f3f3f3]">
        {planets.map((item) => (
          <li key={item!.label} className="flex items-center gap-3 py-3 text-[13px] text-[#3a3a3a]">
            <span className="flex h-8 w-8 items-center justify-center rounded-full bg-[#f7f7f7]">
              <PlanetIcon planet={item!.icon} size={16} stroke="#555" strokeWidth={1.5} />
            </span>
            <span className="font-medium">{item!.label}</span>
            <span className="text-[#888]">{item!.sign}</span>
            {item!.house ? <span className="text-[#aaa]">{item!.house}</span> : null}
            {item!.retrograde ? <span className="font-mono text-[11px] text-[#777]">R</span> : null}
            {item!.degree ? <span className="ml-auto font-mono text-[12px] text-[#aaa]">{item!.degree}</span> : null}
          </li>
        ))}
      </ul>
      {aspects.length ? (
        <div className="mt-6">
          <h4 className="text-[12px] font-semibold uppercase tracking-[0.12em] text-[#777]">
            {language === 'ru' ? 'Аспекты' : 'Aspects'}
          </h4>
          <ul className="mt-2 divide-y divide-[#f3f3f3]">
            {aspects.map((aspect) => (
              <li key={aspect.id} className="flex items-center gap-2 py-2.5 text-[12.5px] text-[#555]">
                <span>{aspect.from}</span>
                <span className="text-[#999]">{aspect.type}</span>
                <span>{aspect.to}</span>
                {aspect.phase ? <span className="text-[#aaa]">{aspect.phase}</span> : null}
                {aspect.orb ? <span className="ml-auto font-mono text-[#888]">{aspect.orb}</span> : null}
              </li>
            ))}
          </ul>
        </div>
      ) : null}
      {houses.length ? (
        <div className="mt-6">
          <h4 className="text-[12px] font-semibold uppercase tracking-[0.12em] text-[#777]">
            {language === 'ru' ? 'Куспиды домов' : 'House cusps'}
          </h4>
          <ul className="mt-2 grid grid-cols-2 gap-x-5 gap-y-2 text-[12.5px] text-[#555]">
            {houses.map((house: any, index) => (
              <li key={house.house || index} className="flex items-baseline justify-between gap-2">
                <span>
                  {house.house || index + 1} · {language === 'ru' ? ruSign(house.sign) : house.sign}
                </span>
                <span className="font-mono text-[#999]">{fmtDegree(house.degree)}</span>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </details>
  );
};

const StatementText: React.FC<{
  statement: NatalReadingStatement;
  className?: string;
}> = ({
  statement,
  className = '',
}) => (
  <div className="natal-statement">
    <FormattedAiText
      text={statement.text}
      className={`max-w-none ${className}`}
      paragraphClassName="natal-sec-p"
    />
  </div>
);

const PremiumReport: React.FC<{
  report: NatalPermanentPremiumReport;
}> = ({ report }) => (
  <section className="natal-permanent-premium" data-natal-contract={report.contractVersion}>
    {report.sections.map((section) => (
      <section key={section.id} className="natal-sec editorial-reading-section" data-premium-section={section.id}>
        {section.title ? <h2 className="natal-sec-title">{section.title}</h2> : null}
        <div className="natal-sec-body">
          {section.paragraphs.map((paragraph, index) => (
            <StatementText
              key={`${section.id}-${index}`}
              statement={paragraph}
            />
          ))}
        </div>
      </section>
    ))}
  </section>
);

const NatalReadingSkeleton: React.FC<{ language: 'ru' | 'en' }> = ({ language }) => (
  <section
    data-testid="human-report-loading-area"
    className="natal-reading-skeleton"
    role="status"
    aria-label={language === 'ru' ? 'Подготавливаем разбор карты' : 'Preparing the chart reading'}
  >
    <span className="sr-only">
      {language === 'ru' ? 'Подготавливаем разбор карты.' : 'Preparing the chart reading.'}
    </span>
    <div className="natal-reading-skeleton-visual" aria-hidden="true">
      <div className="natal-reading-skeleton-hook">
        <span />
        <span />
      </div>
      {[0, 1].map((index) => (
        <div key={index} className="natal-reading-skeleton-section">
          <span className="natal-reading-skeleton-title" />
          <span className="natal-reading-skeleton-line" />
          <span className="natal-reading-skeleton-line" />
          <span className="natal-reading-skeleton-line" />
        </div>
      ))}
    </div>
  </section>
);

const NatalPremiumSkeleton: React.FC<{ language: 'ru' | 'en' }> = ({ language }) => (
  <section
    className="natal-premium-skeleton"
    role="status"
    aria-label={language === 'ru' ? 'Подготавливаем полный разбор' : 'Preparing the full reading'}
  >
    <span className="sr-only">
      {language === 'ru' ? 'Подготавливаем полный разбор.' : 'Preparing the full reading.'}
    </span>
    <span aria-hidden="true" />
    <span aria-hidden="true" />
    <span aria-hidden="true" />
  </section>
);

export const HumanReport: React.FC<Props> = ({
  profile,
  chartData,
  chartId,
  chartSubject,
  requestPremium,
  onUpdateProfile: _onUpdateProfile,
  preloadedReport,
  hideIntro,
  premiumContinuation,
  onPremiumContinuationHandled,
  canPromotePremium = true,
  onOpenQuestions,
  surface = 'reading',
  uiPreview,
}) => {
  const userId = profile.id ? String(profile.id) : '';
  const subjectName = chartSubject?.name || profile.name;
  const language: 'ru' | 'en' = profile.language === 'en' ? 'en' : 'ru';
  const cacheIdentity = useMemo(() => ({
    chartFingerprint: buildPermanentNatalChartFingerprint(profile, chartData),
    reportVersion: NATAL_PERMANENT_CONTRACT_VERSION,
  }), [chartData, profile]);
  const matchingPreloadedReport = useMemo(() => (
    preloadedReport
    && preloadedReport.chartFingerprint === cacheIdentity.chartFingerprint
    && preloadedReport.reportVersion === cacheIdentity.reportVersion
    && isNatalPermanentFreeReport(preloadedReport.report)
      ? preloadedReport.report
      : null
  ), [cacheIdentity.chartFingerprint, cacheIdentity.reportVersion, preloadedReport]);
  const previewConfig = process.env.NODE_ENV === 'development'
    && process.env.NEXT_PUBLIC_UI_PREVIEW === '1'
      ? uiPreview
      : undefined;
  const previewState = previewConfig?.state || 'ready';
  const previewPremiumReport = previewConfig?.premiumReport || null;
  const builtNatalContext = useMemo(
    () => buildNatalModelContext(profile, chartData),
    [chartData, profile],
  );
  const evidenceById = useMemo<NatalEvidenceMap>(() => {
    return new Map(builtNatalContext.context.evidence.map((fact) => [fact.id, fact]));
  }, [builtNatalContext]);
  const cachedBase = userId ? getHumanBaseReportCached(userId, chartId, language, cacheIdentity) : null;
  const initialBase = previewConfig && previewState !== 'ready'
    ? null
    : matchingPreloadedReport || cachedBase;
  const cachedPremium = userId
    ? getHumanPremiumReportCached(userId, chartId, language, cacheIdentity)?.content || null
    : null;
  const [report, setReport] = useState<NatalPermanentFreeReport | null>(initialBase);
  const [premiumReport, setPremiumReport] = useState<NatalPermanentPremiumReport | null>(
    previewPremiumReport || cachedPremium,
  );
  const [loading, setLoading] = useState(previewConfig ? previewState === 'loading' : !initialBase);
  const [error, setError] = useState<string | null>(
    previewConfig && previewState === 'error' ? 'Проверь соединение и попробуй снова.' : null,
  );
  const [premiumLoading, setPremiumLoading] = useState(false);
  const [premiumError, setPremiumError] = useState<string | null>(null);
  const [questionSnapshot, setQuestionSnapshot] = useState<NatalQuestionSnapshot | null>(null);
  const [questionText, setQuestionText] = useState('');
  const [questionLoading, setQuestionLoading] = useState(false);
  const [questionSubmitting, setQuestionSubmitting] = useState(false);
  const [questionError, setQuestionError] = useState<string | null>(null);
  const [unansweredQuestionText, setUnansweredQuestionText] = useState<string | null>(null);
  const [questionRetryToken, setQuestionRetryToken] = useState(0);
  const [baseRetryToken, setBaseRetryToken] = useState(0);
  const [premiumRetryToken, setPremiumRetryToken] = useState(0);
  const reportIdentity = `${userId}:${chartId ?? 'primary'}:${language}:${cacheIdentity.chartFingerprint}:${cacheIdentity.reportVersion}`;
  const baseIdentityRef = useRef(reportIdentity);
  const premiumIdentityRef = useRef(reportIdentity);

  const isPremium = hasActivePremium(profile);
  const reliability = getPermanentNatalReliability(chartData);
  const freeSections = report?.freeSections || [];
  const questionPairs = useMemo(
    () => buildNatalQuestionPairs(questionSnapshot?.messages || []),
    [questionSnapshot?.messages],
  );
  useEffect(() => {
    if (surface !== 'reading') return;
    if (previewConfig) {
      setReport(previewState === 'ready' ? matchingPreloadedReport : null);
      setLoading(previewState === 'loading');
      setError(previewState === 'error'
        ? (language === 'ru'
            ? 'Проверь соединение и попробуй снова.'
            : 'Check your connection and try again.')
        : null);
      return;
    }
    if (!userId) return;
    let cancelled = false;
    const cached = getHumanBaseReportCached(userId, chartId, language, cacheIdentity);
    const preload = matchingPreloadedReport;
    const available = cached || preload;
    const identityChanged = baseIdentityRef.current !== reportIdentity;
    baseIdentityRef.current = reportIdentity;
    if (available) setReport(available);
    else if (identityChanged) setReport(null);
    setLoading(!available);
    setError(null);
    void ensureHumanBaseReport(userId, chartId, language, cacheIdentity)
      .then((next) => {
        if (!cancelled) setReport(next);
      })
      .catch((loadError) => {
        if (!cancelled && !available) setError(formatError(loadError));
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => { cancelled = true; };
  }, [
    baseRetryToken,
    cacheIdentity,
    chartId,
    language,
    matchingPreloadedReport,
    previewConfig,
    previewState,
    reportIdentity,
    surface,
    userId,
  ]);

  useEffect(() => {
    if (surface !== 'reading') return;
    if (previewConfig) {
      setPremiumReport(isPremium ? previewPremiumReport : null);
      setPremiumLoading(false);
      setPremiumError(null);
      return;
    }
    if (!isPremium || !userId || !report) {
      setPremiumReport(null);
      setPremiumLoading(false);
      return;
    }
    let cancelled = false;
    const cached = getHumanPremiumReportCached(userId, chartId, language, cacheIdentity)?.content || null;
    const identityChanged = premiumIdentityRef.current !== reportIdentity;
    premiumIdentityRef.current = reportIdentity;
    if (cached) setPremiumReport(cached);
    else if (identityChanged) setPremiumReport(null);
    setPremiumLoading(!cached);
    setPremiumError(null);
    void ensureHumanPremiumReport(userId, chartId, language, cacheIdentity)
      .then((result) => {
        if (!cancelled) setPremiumReport(result.content);
      })
      .catch((loadError) => {
        if (!cancelled) setPremiumError(formatError(loadError));
      })
      .finally(() => {
        if (!cancelled) setPremiumLoading(false);
      });
    return () => { cancelled = true; };
  }, [
    cacheIdentity,
    chartId,
    isPremium,
    language,
    premiumRetryToken,
    previewConfig,
    previewPremiumReport,
    report,
    reportIdentity,
    surface,
    userId,
  ]);

  useEffect(() => {
    setQuestionSnapshot(null);
    setQuestionText('');
    setQuestionError(null);
    setUnansweredQuestionText(null);
  }, [reportIdentity]);

  useEffect(() => {
    if (surface !== 'questions') return;
    if (previewConfig) {
      setQuestionSnapshot(null);
      setQuestionLoading(previewState === 'loading');
      setQuestionError(previewState === 'error'
        ? (language === 'ru'
            ? 'Не удалось загрузить ответы. Проверь соединение и попробуй ещё раз.'
            : 'Unable to load the answers. Check your connection and try again.')
        : null);
      return;
    }
    if (!isPremium || !userId) {
      setQuestionLoading(false);
      return;
    }
    let cancelled = false;
    setQuestionLoading(true);
    setQuestionError(null);
    void loadNatalQuestionSnapshot(userId, chartId)
      .then((next) => {
        if (cancelled) return;
        setQuestionSnapshot(next);
        const latest = buildNatalQuestionPairs(next.messages).at(-1);
        const pendingText = latest && !latest.answer ? latest.question.text : null;
        setUnansweredQuestionText(pendingText);
        if (pendingText) {
          setQuestionText((current) => current.trim() ? current : pendingText);
        }
      })
      .catch((loadError) => {
        if (!cancelled) setQuestionError(formatQuestionError(loadError, language));
      })
      .finally(() => {
        if (!cancelled) setQuestionLoading(false);
      });
    return () => { cancelled = true; };
  }, [
    chartId,
    isPremium,
    language,
    previewConfig,
    previewState,
    questionRetryToken,
    reportIdentity,
    surface,
    userId,
  ]);

  useEffect(() => {
    if (!isPremium || !premiumContinuation || premiumContinuation.returnView !== 'chart') return;
    if (
      premiumContinuation.featureKey === 'natal_questions'
      && premiumContinuation.returnAction === 'open_natal_questions'
      && surface === 'questions'
    ) {
      onPremiumContinuationHandled?.(premiumContinuation.paywallInstanceId);
      return;
    }
    if (
      (premiumContinuation.featureKey === 'natal_deep'
        || premiumContinuation.featureKey === 'personality_deep')
      && premiumReport
      && surface === 'reading'
    ) {
      document.getElementById('natal-deep-premium')?.scrollIntoView({ block: 'center' });
      onPremiumContinuationHandled?.(premiumContinuation.paywallInstanceId);
    }
  }, [
    isPremium,
    onPremiumContinuationHandled,
    premiumContinuation,
    premiumReport,
    surface,
  ]);

  const submitQuestion = async (event: React.FormEvent) => {
    event.preventDefault();
    const value = questionText.trim();
    const retryMatches = !unansweredQuestionText || (
      normalizePersonalForecastQuestionInput(value).toLocaleLowerCase()
      === normalizePersonalForecastQuestionInput(unansweredQuestionText).toLocaleLowerCase()
    );
    if (!userId || !value || !retryMatches || questionLoading || questionSubmitting) return;
    setQuestionSubmitting(true);
    setQuestionError(null);
    try {
      const next = await askNatalQuestion(userId, value, chartId);
      setQuestionSnapshot(next);
      setQuestionText('');
      setUnansweredQuestionText(null);
    } catch (submitError) {
      if ((submitError as HumanReadingError)?.code === 'NATAL_QUESTION_GENERATION_FAILED') {
        setUnansweredQuestionText(value);
      }
      setQuestionError(formatQuestionError(submitError, language));
    } finally {
      setQuestionSubmitting(false);
    }
  };

  if (surface === 'questions') {
    const remainingQuestions = questionSnapshot?.usage.remaining ?? null;
    const normalizedQuestionText = normalizePersonalForecastQuestionInput(questionText)
      .toLocaleLowerCase();
    const normalizedUnansweredQuestion = normalizePersonalForecastQuestionInput(
      unansweredQuestionText,
    ).toLocaleLowerCase();
    const canRetryUnanswered = Boolean(
      unansweredQuestionText
      && normalizedQuestionText
      && normalizedQuestionText === normalizedUnansweredQuestion,
    );
    const questionLimitReached = remainingQuestions === 0 && !unansweredQuestionText;
    const questionInputDisabled = questionLoading
      || questionSubmitting
      || questionLimitReached
      || !userId;
    const questionStatus = questionSubmitting
      ? (language === 'ru' ? 'Готовим ответ…' : 'Preparing your answer…')
      : questionLoading
        ? (questionSnapshot
            ? (language === 'ru' ? 'Обновляем ответы…' : 'Refreshing your answers…')
            : (language === 'ru' ? 'Загружаем ответы…' : 'Loading your answers…'))
      : unansweredQuestionText
        ? (canRetryUnanswered
            ? (language === 'ru'
                ? 'Предыдущий вопрос остался без ответа. Отправь его ещё раз — лимит не спишется.'
                : 'The previous question has no answer. Submit it again without using another question.')
            : (language === 'ru'
                ? 'Сейчас можно повторить только вопрос, который остался без ответа.'
                : 'For now, you can only retry the unanswered question.'))
      : questionLimitReached
        ? (language === 'ru'
            ? 'На сегодня вопросы закончились. Можно вернуться завтра.'
            : 'You have used today\'s questions. You can return tomorrow.')
        : remainingQuestions != null
          ? (language === 'ru'
              ? `Осталось сегодня: ${remainingQuestions}`
              : `Remaining today: ${remainingQuestions}`)
          : !userId && previewConfig
            ? (language === 'ru'
                ? 'В локальном превью отправка отключена.'
                : 'Sending is disabled in the local preview.')
          : (language === 'ru'
              ? 'Ответ появится здесь и сохранится в истории.'
              : 'Your answer will appear here and stay in the history.');

    return (
      <article
        id="natal-question-page"
        className="natal-question-page"
        aria-labelledby="natal-question-page-title"
      >
        <div className="natal-question-page-inner">
          {!isPremium ? (
            <section className="natal-question-locked" aria-labelledby="natal-question-locked-title">
              <h2 id="natal-question-locked-title">
                {language === 'ru'
                  ? 'Вопросы по карте доступны в Premium'
                  : 'Questions about your chart are available with Premium'}
              </h2>
              <p>
                {language === 'ru'
                  ? 'Ответ строится по сохранённой натальной карте. До 5 принятых вопросов в день.'
                  : 'Answers are based on your saved natal chart. Up to 5 accepted questions per day.'}
              </p>
              <button
                type="button"
                className="natal-question-premium-button"
                onClick={() => void requestPremium('natal_questions', {
                  placement: 'natal_questions',
                  featureKey: 'natal_questions',
                  triggerType: 'locked_feature',
                  returnView: 'chart',
                  returnScrollAnchor: 'natal-question-page',
                  returnAction: 'open_natal_questions',
                })}
              >
                <Crown aria-hidden="true" size={16} strokeWidth={2} />
                {language === 'ru' ? 'Открыть Premium' : 'Open Premium'}
              </button>
            </section>
          ) : (
            <>
              <section className="natal-question-composer" aria-labelledby="natal-question-composer-title">
                <form
                  onSubmit={submitQuestion}
                  aria-busy={(questionLoading || questionSubmitting) || undefined}
                >
                  <div className="natal-question-composer-copy">
                    <label id="natal-question-composer-title" htmlFor="natal-question-input">
                      {language === 'ru' ? 'Что хочешь понять о себе?' : 'What do you want to understand about yourself?'}
                    </label>
                    <p id="natal-question-input-help">
                      {language === 'ru'
                        ? 'Ответ строится по сохранённой натальной карте. Спроси о свой реакции, решении, отношениях, работе, деньгах или сильной стороне. До 5 принятых вопросов в день.'
                        : 'Answers are based on your saved chart. Ask about your reaction, decision, relationships, work, money, or a strength. Up to 5 accepted questions per day.'}
                    </p>
                  </div>
                  <div className="natal-question-suggestions" aria-labelledby="natal-question-suggestions-title">
                    <p id="natal-question-suggestions-title">
                      {language === 'ru' ? 'Можно начать так' : 'Try one of these'}
                    </p>
                    <ul role="list">
                      {NATAL_QUESTION_STARTERS.map((starter) => {
                        const suggestion = starter[language];
                        return (
                          <li key={starter.ru}>
                            <button
                              type="button"
                              onClick={() => {
                                setQuestionText(suggestion);
                                setQuestionError(null);
                              }}
                              disabled={questionInputDisabled || Boolean(unansweredQuestionText)}
                            >
                              {suggestion}
                            </button>
                          </li>
                        );
                      })}
                    </ul>
                  </div>
                  <textarea
                    id="natal-question-input"
                    name="natal-question"
                    value={questionText}
                    onChange={(event) => setQuestionText(event.target.value)}
                    maxLength={300}
                    rows={4}
                    placeholder={language === 'ru'
                      ? 'Например: почему мне трудно просить о помощи?'
                      : 'For example: why is it hard for me to ask for help?'}
                    className="natal-question-input"
                    aria-describedby="natal-question-input-help natal-question-status"
                    disabled={questionInputDisabled}
                  />
                  <div className="natal-question-form-actions">
                    <p id="natal-question-status" className="natal-question-status" aria-live="polite">
                      {questionStatus}
                    </p>
                    <button
                      type="submit"
                      disabled={questionInputDisabled
                        || !questionText.trim()
                        || Boolean(unansweredQuestionText && !canRetryUnanswered)}
                      className="natal-question-submit"
                    >
                      <Send aria-hidden="true" size={16} strokeWidth={2} />
                      {canRetryUnanswered
                        ? (language === 'ru' ? 'Повторить вопрос' : 'Retry question')
                        : (language === 'ru' ? 'Задать вопрос' : 'Ask a question')}
                    </button>
                  </div>
                  {questionError && questionSnapshot ? (
                    <p className="natal-question-error" role="alert">{questionError}</p>
                  ) : null}
                </form>
              </section>

              <section className="natal-question-history" aria-labelledby="natal-question-history-title">
                <h2 id="natal-question-history-title">
                  {language === 'ru' ? 'Твои вопросы' : 'Your questions'}
                </h2>
                {questionLoading && !questionSnapshot ? (
                  <p className="natal-question-state" role="status">
                    {language === 'ru' ? 'Загружаем прошлые ответы…' : 'Loading previous answers…'}
                  </p>
                ) : questionError && !questionSnapshot ? (
                  <div className="natal-question-state natal-question-state--error" role="alert">
                    <p>{questionError}</p>
                    <button type="button" onClick={() => setQuestionRetryToken((value) => value + 1)}>
                      {language === 'ru' ? 'Попробовать ещё раз' : 'Try again'}
                    </button>
                  </div>
                ) : questionPairs.length ? (
                  <ol className="natal-question-pairs" role="list">
                    {questionPairs.map(({ question, answer }) => (
                      <li key={question.id} className="natal-question-pair">
                        <article>
                          <p className="natal-question-pair-label">
                            {language === 'ru' ? 'Вопрос' : 'Question'}
                          </p>
                          <h3>{question.text}</h3>
                          {answer ? (
                            <div className="natal-question-answer">
                              <p className="natal-question-pair-label">
                                {language === 'ru' ? 'Ответ' : 'Answer'}
                              </p>
                              <FormattedAiText
                                text={answer.text}
                                className="natal-question-answer-text"
                                paragraphClassName="natal-question-answer-paragraph"
                              />
                            <NatalEvidenceDetails
                              evidenceIds={questionMessageEvidenceIds(answer)}
                              evidenceById={evidenceById}
                              language={language}
                              summary={language === 'ru'
                                ? 'Как это связано с картой'
                                : 'How this connects to the chart'}
                            />
                            </div>
                          ) : (
                            <p className="natal-question-state" role="status">
                              {language === 'ru'
                                ? 'Ответ не завершён. Повтори вопрос выше.'
                                : 'The answer was not completed. Retry the question above.'}
                            </p>
                          )}
                        </article>
                      </li>
                    ))}
                  </ol>
                ) : (
                  <p className="natal-question-state">
                    {language === 'ru'
                      ? 'Здесь появятся принятые вопросы и ответы по сохранённой натальной карте.'
                      : 'Accepted questions and answers based on your saved natal chart will appear here.'}
                  </p>
                )}
              </section>
            </>
          )}
        </div>
      </article>
    );
  }

  return (
    <article className="natal-editorial-report relative bg-white pb-16 pt-1">
      <div className={`natal-editorial-report-inner relative z-10 w-full ${hideIntro ? '' : 'mx-auto max-w-reading-wide px-5'}`}>
        {!hideIntro ? (
          <header className="pb-6">
            <p className="font-sans text-[11px] font-semibold uppercase tracking-[0.18em] text-[#6b6b6b]">
              {language === 'ru' ? 'Натальная карта' : 'Natal chart'}
            </p>
            <h1 className="mt-3 font-sans text-[36px] font-semibold leading-[1.02] tracking-[-0.035em] text-[#1f1f1f] sm:text-[44px]">
              {subjectName || report?.userName || (language === 'ru' ? 'Твоя карта' : 'Your chart')}
            </h1>
          </header>
        ) : null}

        {reliability.quality === 'unknown' ? (
          <p className="natal-reliability-note">
            {language === 'ru'
              ? 'Время рождения неизвестно, поэтому разбор не использует первое впечатление, дома и другие детали, которые зависят от времени. Остальной портрет опирается на надёжные положения и аспекты.'
              : 'Birth time is unknown, so the reading excludes first impressions, houses, and other time-dependent details. The rest uses reliable placements and aspects.'}
          </p>
        ) : reliability.quality === 'approximate' ? (
          <p className="natal-reliability-note">
            {language === 'ru'
              ? 'Время рождения приблизительное, поэтому в разбор вошли только данные, устойчивые к этой погрешности.'
              : 'Birth time is approximate, so the reading uses only details stable within that uncertainty.'}
          </p>
        ) : null}

        <div aria-live="polite" aria-busy={loading && !report}>
          {loading && !report ? (
            <NatalReadingSkeleton language={language} />
          ) : error || !report ? (
            <section className="natal-report-error natal-report-error--base" role="alert">
              <h2>
                {language === 'ru' ? 'Интерпретация сейчас недоступна' : 'The interpretation is unavailable'}
              </h2>
              <p>{error}</p>
              <button
                type="button"
                className="natal-report-retry"
                onClick={() => setBaseRetryToken((value) => value + 1)}
              >
                {language === 'ru' ? 'Попробовать ещё раз' : 'Try again'}
              </button>
            </section>
          ) : (
            <>
              <header className="natal-reading-hook">
                <FormattedAiText
                  text={report.hook.text}
                  className="natal-reading-hook-text"
                  paragraphClassName="natal-reading-hook-paragraph"
                />
              </header>
              {freeSections.map((item, index) => (
                <SectionText
                  key={item.key}
                  section={item}
                  index={index}
                />
              ))}
            </>
          )}
        </div>

        {report ? (
          <>
            {isPremium ? (
              premiumLoading && !premiumReport ? (
                <NatalPremiumSkeleton language={language} />
              ) : premiumReport ? (
                <div id="natal-deep-premium">
                  <PremiumReport
                    report={premiumReport}
                  />
                </div>
              ) : premiumError ? (
                <section className="natal-report-error" role="alert">
                  <p>{premiumError}</p>
                  <button
                    type="button"
                    className="natal-report-retry"
                    onClick={() => setPremiumRetryToken((value) => value + 1)}
                  >
                    {language === 'ru' ? 'Попробовать ещё раз' : 'Try again'}
                  </button>
                </section>
              ) : null
            ) : canPromotePremium ? (
              <section id="natal-deep-premium" className="natal-premium-callout">
                <h2>
                  {language === 'ru' ? 'Полный портрет карты' : 'The complete chart portrait'}
                </h2>
                <p>
                  {language === 'ru'
                    ? 'В полном разборе добавятся главы об отношениях и семье, работе и своём деле, а также о ситуациях, когда всё идёт не по плану.'
                    : 'The full reading adds chapters about relationships and family, work and your own business, and situations when things do not go to plan.'}
                </p>
                <button
                  type="button"
                  onClick={() => void requestPremium('deep_natal', {
                    placement: 'deep_natal',
                    featureKey: 'natal_deep',
                    triggerType: 'locked_feature',
                    returnView: 'chart',
                    returnScrollAnchor: 'natal-deep-premium',
                    returnAction: 'open_deep_natal',
                  })}
                  className="natal-premium-button"
                >
                  <Crown aria-hidden="true" size={16} strokeWidth={2} />
                  {language === 'ru' ? 'Открыть в Premium' : 'Unlock with Premium'}
                </button>
              </section>
            ) : null}

            {onOpenQuestions ? (
              <section className="natal-question-action">
                <button
                  type="button"
                  className="natal-question-button"
                  onClick={onOpenQuestions}
                  aria-describedby="natal-question-action-description"
                >
                  <Send aria-hidden="true" size={16} strokeWidth={2} />
                  {language === 'ru' ? 'Спросить о себе' : 'Ask about yourself'}
                </button>
                <p id="natal-question-action-description">
                  {language === 'ru'
                    ? 'Получишь ответ по сохранённой натальной карте: о привычных реакциях, решениях, отношениях, работе, деньгах или сильных сторонах.'
                    : 'Get an answer based on your saved natal chart about recurring reactions, decisions, relationships, work, money, or strengths.'}
                </p>
              </section>
            ) : null}

            <TechnicalDetails chartData={chartData} language={language} />

            <section className="natal-disclaimer">
              <p>
                {language === 'ru'
                  ? 'Это ознакомительный разбор. Он не заменяет медицинские, юридические, финансовые или иные профессиональные рекомендации.'
                  : 'This is an informational reading. It does not replace medical, legal, financial, or other professional advice.'}
              </p>
            </section>
          </>
        ) : null}

      </div>
    </article>
  );
};
