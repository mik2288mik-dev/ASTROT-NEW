import React, { Fragment, useEffect, useRef, useState } from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import { ChevronDown, Crown, MessageCircle, Send } from 'lucide-react';
import type {
  InterpretationSection,
  NatalChartData,
  NatalInterpretationReport,
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
  getPermanentNatalReliability,
  isNatalPermanentFreeReport,
  type NatalPermanentFreeReport,
  type NatalPermanentPremiumReport,
  type NatalReadingStatement,
} from '../../lib/natalReading/permanentReport';
import type { NatalQuestionSnapshot } from '../../lib/natalReading/natalQuestion';
import type { EditorialStickerAsset } from '../../lib/personalForecastVisuals/editorialTypes';
import type { ChartListItem } from '../../services/storageService';
import { PlanetIcon } from '../icons/PlanetIcon';
import { FormattedAiText } from '../ui/FormattedAiText';
import { MONO_EASE } from '../mono-ui/motion';
import { ChartBalance } from './ChartBalance';
import { EditorialSticker } from '../EditorialSticker';
import { CosmicSheet } from '../lumia-ui/CosmicSheet';

type Props = {
  profile: UserProfile;
  chartData: NatalChartData;
  chartId?: number;
  chartSubject?: ChartListItem | null;
  requestPremium: () => void;
  onUpdateProfile?: (profile: UserProfile) => void;
  preloadedReport?: NatalInterpretationReport | null;
  editorialSticker?: EditorialStickerAsset | null;
  /** Шапку (имя/дата/интро) рисует родитель (NatalMagazine) — не дублируем. */
  hideIntro?: boolean;
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

const ANGLE_NAMES = /^(?:ascendant|asc|rising|mc|midheaven|descendant|desc|dsc|ic)$/iu;
const ANGLE_ALIAS: Record<string, 'ascendant' | 'mc' | 'descendant' | 'ic'> = {
  ascendant: 'ascendant',
  asc: 'ascendant',
  rising: 'ascendant',
  mc: 'mc',
  midheaven: 'mc',
  descendant: 'descendant',
  desc: 'descendant',
  dsc: 'descendant',
  ic: 'ic',
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

const TechnicalDetails: React.FC<{ chartData: NatalChartData; language: 'ru' | 'en' }> = ({
  chartData,
  language,
}) => {
  const reliability = getPermanentNatalReliability(chartData);
  const positions = chartData.positions as Record<string, any> | undefined;
  const chartQualityV2 = chartData.chartQuality as unknown as {
    stableHousePlacements?: string[];
    variableAngles?: string[];
    variableHouses?: number[];
  } | undefined;
  const stableHousePlacements = new Set(chartQualityV2?.stableHousePlacements || []);
  const variableAngles = new Set(chartQualityV2?.variableAngles || []);
  const variableHouses = new Set(chartQualityV2?.variableHouses || []);
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
      degree: fmtDegree(position.degree),
      house: showHouse && position.house != null
        ? `${position.house} ${language === 'ru' ? 'дом' : 'house'}`
        : '',
      retrograde: position.retrograde === true,
    };
  }).filter(Boolean);
  const aspects = (chartData.aspects || [])
    .filter((aspect: any) => {
      if (aspect?.reliable === false) return false;
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
        <span>{language === 'ru' ? 'Технический атлас карты' : 'Technical chart atlas'}</span>
        <ChevronDown size={16} strokeWidth={1.7} />
      </summary>
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

const StatementText: React.FC<{ statement: NatalReadingStatement; className?: string }> = ({
  statement,
  className = '',
}) => (
  <FormattedAiText
    text={statement.text}
    className={`max-w-none ${className}`}
    paragraphClassName="natal-sec-p"
  />
);

const PremiumReport: React.FC<{
  report: NatalPermanentPremiumReport;
  language: 'ru' | 'en';
}> = ({ report, language }) => (
  <section className="natal-permanent-premium" data-natal-contract={report.contractVersion}>
    <header className="natal-premium-lead">
      <h2 className="natal-sec-title">{report.headline}</h2>
      <StatementText statement={report.lead} />
    </header>
    {report.sections.map((section) => (
      <section key={section.id} className="natal-sec editorial-reading-section" data-premium-section={section.id}>
        <h2 className="natal-sec-title">{section.title}</h2>
        <div className="natal-sec-body">
          {section.paragraphs.map((paragraph, index) => (
            <StatementText key={`${section.id}-${index}`} statement={paragraph} />
          ))}
        </div>
      </section>
    ))}
    {report.strategies.length ? (
      <section className="natal-sec editorial-reading-section">
        <h2 className="natal-sec-title">
          {language === 'ru' ? 'Как раскрывать потенциал' : 'How to use your potential'}
        </h2>
        <div className="natal-sec-body">
          {report.strategies.map((strategy, index) => (
            <div key={`${strategy.title}-${index}`} className="mb-4 last:mb-0">
              <h3 className="text-[18px] font-semibold leading-tight text-[#171717]">{strategy.title}</h3>
              <StatementText statement={strategy} className="mt-2" />
            </div>
          ))}
        </div>
      </section>
    ) : null}
    {report.pitfalls.length ? (
      <section className="natal-sec editorial-reading-section">
        <h2 className="natal-sec-title">{language === 'ru' ? 'Что сбивает' : 'What gets in the way'}</h2>
        <div className="natal-sec-body">
          {report.pitfalls.map((pitfall, index) => (
            <StatementText key={`pitfall-${index}`} statement={pitfall} />
          ))}
        </div>
      </section>
    ) : null}
    <section className="natal-sec editorial-reading-section natal-reading-final">
      <StatementText statement={report.conclusion} />
    </section>
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
  editorialSticker,
  hideIntro,
}) => {
  const userId = profile.id ? String(profile.id) : '';
  const subjectName = chartSubject?.name || profile.name;
  const language: 'ru' | 'en' = profile.language === 'en' ? 'en' : 'ru';
  const cachedBase = userId ? getHumanBaseReportCached(userId, chartId, language) : null;
  const initialBase = isNatalPermanentFreeReport(preloadedReport)
    ? preloadedReport
    : cachedBase;
  const cachedPremium = userId ? getHumanPremiumReportCached(userId, chartId, language)?.content || null : null;
  const [report, setReport] = useState<NatalPermanentFreeReport | null>(initialBase);
  const [premiumReport, setPremiumReport] = useState<NatalPermanentPremiumReport | null>(cachedPremium);
  const [loading, setLoading] = useState(!initialBase);
  const [error, setError] = useState<string | null>(null);
  const [premiumLoading, setPremiumLoading] = useState(false);
  const [premiumError, setPremiumError] = useState<string | null>(null);
  const [questionOpen, setQuestionOpen] = useState(false);
  const [questionSnapshot, setQuestionSnapshot] = useState<NatalQuestionSnapshot | null>(null);
  const [questionText, setQuestionText] = useState('');
  const [questionLoading, setQuestionLoading] = useState(false);
  const [questionError, setQuestionError] = useState<string | null>(null);
  const baseLanguageRef = useRef(language);
  const premiumLanguageRef = useRef(language);

  const isPremium = hasActivePremium(profile);
  const reliability = getPermanentNatalReliability(chartData);
  const freeSections = report?.freeSections || [];

  useEffect(() => {
    if (!userId) return;
    let cancelled = false;
    const cached = getHumanBaseReportCached(userId, chartId, language);
    const languageChanged = baseLanguageRef.current !== language;
    baseLanguageRef.current = language;
    if (cached) setReport(cached);
    else if (languageChanged) setReport(null);
    setLoading(!cached);
    setError(null);
    void ensureHumanBaseReport(userId, chartId, language)
      .then((next) => {
        if (!cancelled) setReport(next);
      })
      .catch((loadError) => {
        if (!cancelled && !cached) setError(formatError(loadError));
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => { cancelled = true; };
  }, [chartId, language, userId]);

  useEffect(() => {
    if (!isPremium || !userId) {
      setPremiumReport(null);
      setPremiumLoading(false);
      return;
    }
    let cancelled = false;
    const cached = getHumanPremiumReportCached(userId, chartId, language)?.content || null;
    const languageChanged = premiumLanguageRef.current !== language;
    premiumLanguageRef.current = language;
    if (cached) setPremiumReport(cached);
    else if (languageChanged) setPremiumReport(null);
    setPremiumLoading(!cached);
    setPremiumError(null);
    void ensureHumanPremiumReport(userId, chartId, language)
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
  }, [chartId, isPremium, language, userId]);

  const openQuestions = () => {
    if (!isPremium) {
      requestPremium();
      return;
    }
    setQuestionOpen(true);
    setQuestionError(null);
    if (!userId) return;
    setQuestionLoading(true);
    void loadNatalQuestionSnapshot(userId, chartId)
      .then(setQuestionSnapshot)
      .catch((loadError) => setQuestionError(formatError(loadError)))
      .finally(() => setQuestionLoading(false));
  };

  const submitQuestion = async (event: React.FormEvent) => {
    event.preventDefault();
    const value = questionText.trim();
    if (!userId || !value || questionLoading) return;
    setQuestionLoading(true);
    setQuestionError(null);
    try {
      const next = await askNatalQuestion(userId, value, chartId);
      setQuestionSnapshot(next);
      setQuestionText('');
    } catch (submitError) {
      setQuestionError(formatError(submitError));
    } finally {
      setQuestionLoading(false);
    }
  };

  const questionFooter = (
    <form onSubmit={submitQuestion} className="grid gap-2.5">
      <label htmlFor="natal-question-input" className="sr-only">
        {language === 'ru' ? 'Вопрос астрологу' : 'Question for the astrologer'}
      </label>
      <textarea
        id="natal-question-input"
        value={questionText}
        onChange={(event) => setQuestionText(event.target.value)}
        maxLength={300}
        rows={2}
        placeholder={language === 'ru' ? 'Спроси о себе по натальной карте' : 'Ask about yourself through your birth chart'}
        className="w-full resize-none rounded-[18px] border border-white/16 bg-black/28 px-4 py-3 text-[15px] leading-snug text-white outline-none placeholder:text-white/45 focus:border-white/38"
      />
      <button
        type="submit"
        disabled={questionLoading || !questionText.trim() || (questionSnapshot?.usage.remaining ?? 1) <= 0}
        className="flex w-full items-center justify-center gap-2 rounded-full bg-white px-5 py-3 text-[14px] font-semibold text-[#111827] disabled:opacity-50"
      >
        <Send size={16} strokeWidth={2} />
        {questionLoading
          ? (language === 'ru' ? 'Отвечаем...' : 'Answering...')
          : (language === 'ru' ? 'Задать вопрос' : 'Ask')}
      </button>
    </form>
  );

  return (
    <article className="natal-editorial-report relative bg-white pb-16 pt-1">
      <div className={`natal-editorial-report-inner relative z-10 w-full ${hideIntro ? '' : 'mx-auto max-w-reading-wide px-5'}`}>
        {!hideIntro ? (
          <header className="pb-6">
            <p className="font-sans text-[11px] font-semibold uppercase tracking-[0.18em] text-[#6b6b6b]">
              {language === 'ru' ? 'Натальная карта' : 'Natal chart'}
            </p>
            <h1 className="mt-3 font-sans text-[36px] font-semibold leading-[1.02] tracking-[-0.035em] text-[#1f1f1f] sm:text-[44px]">
              {report?.userName || subjectName || (language === 'ru' ? 'Твоя карта' : 'Your chart')}
            </h1>
          </header>
        ) : null}

        {reliability.quality === 'unknown' ? (
          <p className="mb-6 rounded-[16px] bg-[#faf7ef] px-4 py-3 font-sans text-[13px] leading-relaxed text-[#6f6654]">
            {language === 'ru'
              ? 'Время рождения неизвестно. Асцендент, MC, дома, куспиды и управители домов полностью исключены из разбора.'
              : 'Birth time is unknown. Ascendant, MC, houses, cusps, and house rulers are fully excluded from this reading.'}
          </p>
        ) : reliability.quality === 'approximate' ? (
          <p className="mb-6 rounded-[16px] bg-[#faf7ef] px-4 py-3 font-sans text-[13px] leading-relaxed text-[#6f6654]">
            {language === 'ru'
              ? 'Время рождения приблизительное. В разбор включены только те углы и дома, которые расчёт пометил как устойчивые.'
              : 'Birth time is approximate. Only angles and houses explicitly marked stable by the calculation are included.'}
          </p>
        ) : null}

        <div aria-live="polite">
          {loading && !report ? (
            <section data-testid="human-report-loading-area" className="py-5">
              <p className="text-[14px] leading-relaxed text-[#666]">
                {language === 'ru' ? 'Подготавливаем постоянный разбор карты.' : 'Preparing the permanent chart reading.'}
              </p>
            </section>
          ) : error || !report ? (
            <section className="py-8 sm:py-10">
              <p className="font-sans text-[20px] font-semibold tracking-[-0.02em] text-[#1f1f1f]">
                {language === 'ru' ? 'Интерпретация сейчас недоступна' : 'The interpretation is unavailable'}
              </p>
              <p className="mt-2 text-sm leading-relaxed text-[#666]">{error}</p>
            </section>
          ) : (
            <>
              <section className="natal-reading-overview editorial-reading-section" data-natal-contract={report.contractVersion}>
                <h2 className="natal-sec-title">{report.shortCard.title}</h2>
                <FormattedAiText
                  text={report.shortCard.text}
                  className="natal-sec-body max-w-none"
                  paragraphClassName="natal-sec-p"
                />
              </section>
              {freeSections.map((item, index) => (
                <Fragment key={item.key}>
                  <SectionText section={item} index={index} />
                  {index === 0 && editorialSticker ? (
                    <EditorialSticker
                      asset={editorialSticker}
                      className="natal-editorial-sticker natal-editorial-sticker--inline"
                    />
                  ) : null}
                </Fragment>
              ))}
            </>
          )}
        </div>

        {!loading && !error && report ? (
          <ChartBalance chart={chartData} language={language} />
        ) : null}

        {isPremium ? (
          premiumLoading && !premiumReport ? (
            <section className="natal-sec editorial-reading-section" aria-live="polite">
              <p className="natal-sec-p">
                {language === 'ru' ? 'Собираем полный постоянный разбор.' : 'Preparing the full permanent reading.'}
              </p>
            </section>
          ) : premiumReport ? (
            <PremiumReport report={premiumReport} language={language} />
          ) : premiumError ? (
            <p className="py-5 text-[13px] leading-relaxed text-[#a14f4f]">{premiumError}</p>
          ) : null
        ) : (
          <section className="natal-premium-card my-8 overflow-hidden p-5">
            <h2 className="font-sans text-[22px] font-semibold leading-tight">
              {language === 'ru' ? 'Полный портрет карты' : 'The complete chart portrait'}
            </h2>
            <p className="mt-2 text-[14px] leading-relaxed text-[#667085]">
              {language === 'ru'
                ? 'Один цельный постоянный разбор личности, отношений, решений, работы, денег, способностей и внутренних противоречий.'
                : 'One cohesive permanent reading of personality, relationships, decisions, work, money, abilities, and inner contradictions.'}
            </p>
            <button
              type="button"
              onClick={requestPremium}
              className="natal-premium-button mt-4 flex w-full items-center justify-center gap-2 px-5 py-2.5 text-[14px] font-semibold"
            >
              <Crown size={16} strokeWidth={2} />
              {language === 'ru' ? 'Открыть в Premium' : 'Unlock with Premium'}
            </button>
          </section>
        )}

        <section className="my-8 py-2">
          <button
            type="button"
            onClick={openQuestions}
            className="flex w-full items-center justify-center gap-2 rounded-full bg-[#171717] px-5 py-3 text-[14px] font-semibold text-white"
          >
            <MessageCircle size={17} strokeWidth={2} />
            {language === 'ru' ? 'Задать вопрос астрологу' : 'Ask the astrologer'}
          </button>
        </section>

        <section className="natal-disclaimer border-t border-[#eeeeee] py-6">
          <p className="font-sans text-[12.5px] leading-relaxed text-[#777]">
            {language === 'ru'
              ? 'Это ознакомительная интерпретация астрологического расчёта. Она не заменяет медицинские, юридические, финансовые или иные профессиональные рекомендации.'
              : 'This is an informational interpretation of an astrological calculation. It does not replace medical, legal, financial, or other professional advice.'}
          </p>
        </section>

        <TechnicalDetails chartData={chartData} language={language} />
      </div>

      <CosmicSheet
        open={questionOpen}
        title={language === 'ru' ? 'Вопрос астрологу' : 'Ask the astrologer'}
        subtitle={language === 'ru' ? 'Ответ по этой натальной карте' : 'An answer from this birth chart'}
        closeLabel={language === 'ru' ? 'Закрыть' : 'Close'}
        onClose={() => setQuestionOpen(false)}
        footer={questionFooter}
        contentClassName="space-y-4"
      >
        {questionSnapshot?.messages.length ? (
          <div className="space-y-3" aria-live="polite">
            {questionSnapshot.messages.map((message) => (
              <div
                key={message.id}
                className={message.role === 'user'
                  ? 'ml-8 rounded-[18px] bg-white/12 px-4 py-3 text-[14px] leading-relaxed text-white'
                  : 'mr-4 rounded-[18px] bg-black/28 px-4 py-3 text-[14px] leading-relaxed text-white/88'}
              >
                {message.text}
              </div>
            ))}
          </div>
        ) : (
          <p className="text-[14px] leading-relaxed text-white/74">
            {language === 'ru'
              ? 'Спроси о привычной реакции, отношениях, решениях, работе или сильной стороне. Ответ опирается только на расчёт этой карты.'
              : 'Ask about a recurring response, relationships, decisions, work, or a strength. The answer uses only this chart calculation.'}
          </p>
        )}
        {questionSnapshot ? (
          <p className="text-[12px] text-white/52">
            {language === 'ru'
              ? `Осталось вопросов сегодня: ${questionSnapshot.usage.remaining}`
              : `Questions left today: ${questionSnapshot.usage.remaining}`}
          </p>
        ) : null}
        {questionError ? <p className="text-[13px] leading-relaxed text-[#ffb4b4]">{questionError}</p> : null}
      </CosmicSheet>
    </article>
  );
};
