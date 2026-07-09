import React, { useEffect, useMemo, useState } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { ChevronDown, Crown, Lock, X } from 'lucide-react';
import type {
  InterpretationSection,
  NatalChartData,
  NatalInterpretationReport,
  UserProfile,
} from '../../types';
import {
  HUMAN_FREE_SECTION_KEYS,
  HUMAN_MAP_SECTION_KEYS,
  HUMAN_PAID_SECTION_META,
  type HumanPaidSectionKey,
} from '../../lib/natalHumanShared';
import {
  ensureHumanBaseReport,
  getCachedHumanPaidSection,
  getHumanBaseReportCached,
  loadHumanPaidSection,
  type HumanReadingError,
} from '../../services/natalReadingService';
import { hasActivePremium } from '../../lib/accessMatrix';
import {
  readLocalHumanBaseReportWithFallback,
  writeLocalHumanBaseReport,
} from '../../lib/localHumanBaseReportCache';
import { PlanetIcon } from '../icons/PlanetIcon';
import { FormattedAiText } from '../ui/FormattedAiText';
import { MONO_EASE } from '../mono-ui/motion';

type Props = {
  profile: UserProfile;
  chartData: NatalChartData;
  chartId?: number;
  requestPremium: () => void;
  onUpdateProfile?: (profile: UserProfile) => void;
  preloadedReport?: NatalInterpretationReport | null;
  /** Шапку (имя/дата/интро) рисует родитель (NatalMagazine) — не дублируем */
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

const PLANET_LABELS: Array<{ key: keyof NatalChartData; label: string; icon: string }> = [
  { key: 'sun', label: 'Солнце', icon: 'sun' },
  { key: 'moon', label: 'Луна', icon: 'moon' },
  { key: 'mercury', label: 'Меркурий', icon: 'mercury' },
  { key: 'venus', label: 'Венера', icon: 'venus' },
  { key: 'mars', label: 'Марс', icon: 'mars' },
  { key: 'jupiter', label: 'Юпитер', icon: 'jupiter' },
  { key: 'saturn', label: 'Сатурн', icon: 'saturn' },
  { key: 'uranus', label: 'Уран', icon: 'uranus' },
  { key: 'neptune', label: 'Нептун', icon: 'neptune' },
  { key: 'pluto', label: 'Плутон', icon: 'pluto' },
  { key: 'chiron', label: 'Хирон', icon: 'chiron' },
  { key: 'rising', label: 'Асцендент', icon: 'asc' },
];

function ruSign(sign?: string | null): string {
  const value = String(sign || '').trim();
  return SIGN_RU[value] || value || 'знак не определен';
}

function fmtDegree(value?: number | null): string {
  return typeof value === 'number' && Number.isFinite(value) ? `${Math.round(value)}°` : '';
}

function formatError(error: unknown): string {
  const e = error as HumanReadingError;
  if (e?.code === 'PREMIUM_REQUIRED' || e?.code === 'HUMAN_SECTION_LOCKED') {
    return 'Этот раздел доступен в Premium.';
  }
  if (e?.message) return e.message;
  return 'Не удалось загрузить раздел.';
}

const SectionText: React.FC<{ section: InterpretationSection; index?: number }> = ({ section, index = 0 }) => {
  const reduce = useReducedMotion();
  const Comp = reduce ? 'section' : motion.section;

  return (
    <Comp
      {...(!reduce
        ? {
            initial: { opacity: 0, y: 16 },
            whileInView: { opacity: 1, y: 0 },
            viewport: { once: true, margin: '-40px' },
            transition: { duration: 0.36, delay: Math.min(index * 0.05, 0.2), ease: MONO_EASE },
          }
        : {})}
      data-reading-section-key={section.key}
      className="natal-sec"
    >
      <h3 className="natal-sec-title">{section.title}</h3>
      <div className="natal-sec-body">
        <FormattedAiText
          text={section.content}
          className="max-w-none"
          paragraphClassName="natal-sec-p"
        />
      </div>
      {section.bullets?.length ? (
        <ul className="natal-sec-bullets">
          {section.bullets.map((item, bulletIndex) => (
            <li key={`${section.key}-${bulletIndex}`}>{item}</li>
          ))}
        </ul>
      ) : null}
    </Comp>
  );
};

const TOPIC_ACCENTS = ['#1478FF', '#2563EB', '#38BDF8', '#475569', '#64748B', '#0F172A'];

/**
 * Премиум-карточка темы как продолжение базового разбора: тап раскрывает реальный
 * текст по этой теме (теми же стилями .natal-sec-*, что и базовые секции). Без замка
 * и без размытого фейк-текста — премиум уже открыт.
 */
const PaidTopicCard: React.FC<{
  sectionKey: HumanPaidSectionKey;
  index: number;
  isLoading: boolean;
  expanded: boolean;
  reading?: InterpretationSection;
  onToggle: () => void;
}> = ({ sectionKey, index, isLoading, expanded, reading, onToggle }) => {
  const meta = HUMAN_PAID_SECTION_META[sectionKey];
  const accent = TOPIC_ACCENTS[index % TOPIC_ACCENTS.length];

  return (
    <div className="mt-2.5 overflow-hidden fresh-card first:mt-0" style={{ borderLeft: `3px solid ${accent}` }}>
      <button
        type="button"
        onClick={onToggle}
        className="flex w-full items-center gap-3 px-4 py-4 text-left transition active:bg-mono-plate"
      >
        <span className="min-w-0 flex-1">
          <span className="block font-sans text-[16.5px] font-semibold leading-tight tracking-[-0.01em] text-mono-ink">{meta.title}</span>
          <span className="mt-1 block font-sans text-[12.5px] leading-snug text-mono-muted">{meta.subtitle}</span>
        </span>
        {isLoading ? (
          <span className="h-4 w-4 shrink-0 animate-spin rounded-full border-2 border-mono-line border-t-mono-ink" aria-label="Загрузка" />
        ) : (
          <ChevronDown size={18} strokeWidth={2} className={`shrink-0 text-mono-muted transition-transform duration-300 ${expanded ? 'rotate-180' : ''}`} />
        )}
      </button>
      <AnimatePresence initial={false}>
        {expanded && reading ? (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.3, ease: MONO_EASE }}
            className="overflow-hidden"
          >
            <div className="border-t border-mono-line px-4 pb-5 pt-3">
              <div className="natal-sec-body">
                <FormattedAiText text={reading.content} className="max-w-none" paragraphClassName="natal-sec-p" />
              </div>
              {reading.bullets?.length ? (
                <ul className="natal-sec-bullets">
                  {reading.bullets.map((item, i) => <li key={`${sectionKey}-${i}`}>{item}</li>)}
                </ul>
              ) : null}
            </div>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </div>
  );
};

/**
 * Non-premium teaser row — shows the topic title, angle and a blurred personal
 * hook so the user can SEE the depth they'd unlock (instead of one generic CTA).
 * Tapping opens the unlock sheet; it never triggers generation.
 */
const PremiumTopicTeaser: React.FC<{
  sectionKey: HumanPaidSectionKey;
  onClick: () => void;
}> = ({ sectionKey, onClick }) => {
  const meta = HUMAN_PAID_SECTION_META[sectionKey];

  return (
    <motion.button
      type="button"
      onClick={onClick}
      whileTap={{ scale: 0.99 }}
      className="group w-full border-t border-mono-line py-5 text-left first:border-t-0"
    >
      <div className="flex items-start gap-3">
        <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-mono-plate text-mono-ink">
          <Lock size={14} strokeWidth={1.9} />
        </span>
        <span className="min-w-0 flex-1">
          <span className="flex items-baseline justify-between gap-3">
            <span className="block font-sans text-[17px] font-semibold leading-tight tracking-[-0.01em] text-[#1f1f1f]">
              {meta.title}
            </span>
            <span className="shrink-0 font-sans text-[12.5px] text-[#9b59c4]">Открыть</span>
          </span>
          <span className="mt-1 block font-sans text-[12px] uppercase tracking-[0.12em] text-[#a0a0a0]">
            {meta.subtitle}
          </span>
          <span className="relative mt-2.5 block max-h-[3.4rem] overflow-hidden">
            <span className="block select-none font-sans text-[13.5px] leading-[1.6] text-[#3a3a3a] blur-[3px]">
              {meta.teaser}
            </span>
            <span className="pointer-events-none absolute inset-0 bg-gradient-to-b from-transparent via-white/30 to-white" />
          </span>
        </span>
      </div>
    </motion.button>
  );
};

export const NatalUnlockSheet: React.FC<{
  sectionKey: HumanPaidSectionKey;
  isLoading: boolean;
  onClose: () => void;
  onPremium: () => void;
}> = ({ sectionKey, isLoading, onClose, onPremium }) => {
  const meta = HUMAN_PAID_SECTION_META[sectionKey];

  return (
    <div className="fixed inset-0 z-[150] flex items-end justify-center bg-black/38 px-3 pb-3">
      <button type="button" aria-label="Закрыть" className="absolute inset-0 cursor-default" onClick={onClose} />
      <div className="relative w-full max-w-md rounded-[28px] bg-white px-5 pb-5 pt-4 shadow-[0_24px_80px_rgba(0,0,0,0.24)]">
        <div className="mx-auto mb-4 h-1 w-10 rounded-full bg-[#dfdfdf]" />
        <button
          type="button"
          onClick={onClose}
          className="absolute right-4 top-4 flex h-9 w-9 items-center justify-center rounded-full bg-[#f5f5f5] text-[#444]"
          aria-label="Закрыть"
        >
          <X size={17} strokeWidth={2} />
        </button>

        <p className="font-sans text-[11px] font-semibold uppercase tracking-[0.18em] text-[#6b6b6b]">Полный раздел карты</p>
        <h3 className="mt-2 max-w-[18rem] font-sans text-[24px] font-semibold leading-[1.08] tracking-[-0.02em] text-[#1f1f1f]">
          {meta.title}
        </h3>
        <p className="mt-3 font-sans text-[14.5px] leading-relaxed text-[#5f5f5f]">{meta.teaser}</p>

        <div className="mt-5 grid gap-2.5">
          <button
            type="button"
            onClick={onPremium}
            disabled={isLoading}
            className="flex w-full items-center justify-center gap-2 rounded-full bg-[#1f1f1f] px-5 py-3 text-[14px] font-semibold text-white disabled:opacity-60"
          >
            <Crown size={16} strokeWidth={2} />
            {isLoading ? 'Открываем...' : 'Получить Premium'}
          </button>
        </div>
        <p className="mt-3 text-center font-sans text-[12.5px] leading-relaxed text-[#777]">
          Полный доступ к подробным разделам карты — в Premium.
        </p>
      </div>
    </div>
  );
};

const TechnicalDetails: React.FC<{ chartData: NatalChartData }> = ({ chartData }) => {
  const planets = PLANET_LABELS.map((item) => {
    const position = chartData[item.key] as any;
    if (!position?.sign) return null;
    const house = position.house != null ? `${position.house} дом` : '';
    return {
      ...item,
      sign: ruSign(position.sign),
      degree: fmtDegree(position.degree),
      house,
    };
  }).filter(Boolean);

  return (
    <details className="border-t border-[#eeeeee] py-6">
      <summary className="flex cursor-pointer list-none items-center justify-between text-[13px] font-medium text-[#3a3a3a]">
        <span>Подробные положения планет</span>
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
            {item!.degree ? <span className="ml-auto font-mono text-[12px] text-[#aaa]">{item!.degree}</span> : null}
          </li>
        ))}
      </ul>
    </details>
  );
};

export const HumanReport: React.FC<Props> = ({
  profile,
  chartData,
  chartId,
  requestPremium,
  onUpdateProfile: _onUpdateProfile,
  preloadedReport,
  hideIntro,
}) => {
  const userId = profile.id ? String(profile.id) : '';
  const initialReport = preloadedReport
    || (userId ? getHumanBaseReportCached(userId, chartId) || readLocalHumanBaseReportWithFallback(profile, chartId) : null);
  const [report, setReport] = useState<NatalInterpretationReport | null>(initialReport);
  const [loading, setLoading] = useState(!initialReport);
  const [error, setError] = useState<string | null>(null);
  const [paidSections, setPaidSections] = useState<Partial<Record<HumanPaidSectionKey, InterpretationSection>>>({});
  const [paidLoading, setPaidLoading] = useState<HumanPaidSectionKey | null>(null);
  const [sectionError, setSectionError] = useState<string | null>(null);
  const [unlockTarget, setUnlockTarget] = useState<HumanPaidSectionKey | null>(null);
  const [expandedKey, setExpandedKey] = useState<HumanPaidSectionKey | null>(null);

  const isPremium = hasActivePremium(profile);
  const visibleFreeKeys = useMemo(() => new Set<string>(HUMAN_FREE_SECTION_KEYS), []);
  const visibleFreeSections = useMemo(
    () => (report?.freeSections || []).filter((section) => visibleFreeKeys.has(section.key)),
    [report?.freeSections, visibleFreeKeys]
  );

  useEffect(() => {
    if (preloadedReport) {
      writeLocalHumanBaseReport(profile, preloadedReport, chartId);
      setReport(preloadedReport);
      setLoading(false);
      setError(null);
    }
  }, [chartId, preloadedReport, profile]);

  useEffect(() => {
    if (!userId || preloadedReport) return;
    let cancelled = false;
    const cached = getHumanBaseReportCached(userId, chartId)
      || readLocalHumanBaseReportWithFallback(profile, chartId);

    if (cached) {
      setReport(cached);
      setLoading(false);
      setError(null);
    } else if (!report) {
      setLoading(true);
      setError(null);
    }

    // A chartId resolution (primary -> numeric ID) must only refresh the text quietly.
    // HUMAN_MAP_SECTION_KEYS remain click-only below and never trigger generation here.
    void ensureHumanBaseReport(userId, chartId)
      .then((nextReport) => {
        writeLocalHumanBaseReport(profile, nextReport, chartId);
        if (cancelled) return;
        setReport(nextReport);
        setError(null);
      })
      .catch((err) => {
        if (cancelled || cached || report) return;
        setError(formatError(err));
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [chartId, preloadedReport, profile, userId]);

  // Префетч платных тем в фоне после загрузки портрета (премиум): к моменту тапа разбор уже
  // в памяти/кэше и раскрывается мгновенно, а не запускает генерацию по клику.
  useEffect(() => {
    if (!isPremium || !userId || !report) return;
    let cancelled = false;
    void (async () => {
      for (const key of HUMAN_MAP_SECTION_KEYS) {
        if (cancelled) return;
        try {
          await loadHumanPaidSection(userId, key, chartId, { accessTier: 'premium' });
        } catch {
          /* префетч — best-effort, ошибки игнорируем */
        }
        if (cancelled) return;
        await new Promise((resolve) => setTimeout(resolve, 500));
      }
    })();
    return () => { cancelled = true; };
  }, [isPremium, userId, chartId, report]);

  const openPaidSection = async (key: HumanPaidSectionKey) => {
    if (!userId || paidLoading) return;
    setSectionError(null);
    setPaidLoading(key);
    try {
      const cached = await getCachedHumanPaidSection(userId, key, chartId);
      if (cached?.content) {
        setPaidSections((current) => ({ ...current, [key]: cached.content }));
        setUnlockTarget(null);
      } else {
        const generated = await loadHumanPaidSection(userId, key, chartId, { accessTier: 'premium' });
        setPaidSections((current) => ({ ...current, [key]: generated.content }));
        setUnlockTarget(null);
      }
    } catch (err) {
      setSectionError(formatError(err));
    } finally {
      setPaidLoading(null);
    }
  };

  const handleOpenPaid = (key: HumanPaidSectionKey) => {
    if (isPremium) {
      void openPaidSection(key);
      return;
    }
    setSectionError(null);
    setUnlockTarget(key);
  };

  // Премиум: тап по карточке темы раскрывает/сворачивает её разбор; грузим текст при первом открытии.
  const toggleTopic = (key: HumanPaidSectionKey) => {
    if (expandedKey === key) { setExpandedKey(null); return; }
    setExpandedKey(key);
    if (!paidSections[key]) void openPaidSection(key);
  };

  return (
    <article className="relative bg-white pb-16 pt-1">
      {/* Встроенный режим (в NatalMagazine): текст на всю ширину экрана с общими боковыми
          отступами 16px — как big3/ChartBalance выше, без искусственно узкой колонки.
          Standalone (!hideIntro) сохраняет читательскую центрированную колонку. */}
      <div className={`relative z-10 w-full ${hideIntro ? 'px-4' : 'mx-auto max-w-reading-wide px-5'}`}>
        <header className={hideIntro ? 'empty:hidden' : 'pb-6'}>
          {!hideIntro ? (
            <>
              <p className="font-sans text-[11px] font-semibold uppercase tracking-[0.18em] text-[#6b6b6b]">
                Натальная карта
              </p>
              <h1 className="mt-3 font-sans text-[36px] font-semibold leading-[1.02] tracking-[-0.035em] text-[#1f1f1f] sm:text-[44px]">
                {report?.userName || profile.name || 'Твоя карта'}, главный портрет
              </h1>
            </>
          ) : null}
          {((chartData as any).birthTimeQuality === 'unknown' || (chartData as any).chartQuality?.ascendantReliable === false) ? (
            <p className="rounded-[16px] bg-[#faf7ef] px-4 py-3 font-sans text-[13px] leading-relaxed text-[#6f6654]">
              Время рождения указано неточно, поэтому Асцендент и дома могут отличаться. Солнце, Луна и общий портрет остаются полезной основой.
            </p>
          ) : null}
        </header>

        <div aria-live="polite">
          {loading ? (
            <section data-testid="human-report-loading-area" className="border-t border-[#eeeeee] py-5">
              <p className="rounded-[16px] bg-[#faf8fc] px-4 py-3 text-[13px] leading-relaxed text-[#6f6478]">
                Основные данные карты уже готовы. Подгружаем текстовый разбор ниже.
              </p>
            </section>
          ) : error || !report ? (
            <section className="border-t border-[#eeeeee] py-8 sm:py-10">
              <p className="font-sans text-[20px] font-semibold tracking-[-0.02em] text-[#1f1f1f]">Интерпретация сейчас недоступна</p>
              <p className="mt-2 text-sm leading-relaxed text-[#666]">{error || 'Разбор карты подготавливается.'}</p>
            </section>
          ) : (
            visibleFreeSections.map((section, index) => (
              <SectionText key={section.key} section={{ ...section, title: section.key === 'base_portrait' ? 'Кто ты по карте' : section.title }} index={index} />
            ))
          )}
        </div>

        <section className="border-t border-[#eeeeee] py-7">
          <p className="font-sans text-[11px] font-semibold uppercase tracking-[0.16em] text-[#6b6b6b]">Подробные темы по карте</p>
          {!isPremium ? (
            <p className="mt-2 font-sans text-[14px] leading-relaxed text-[#5f5f5f]">
              10 личных разделов по твоей карте — каждый написан под тебя. Загляни, что внутри.
            </p>
          ) : (
            <p className="mt-2 font-sans text-[14px] leading-relaxed text-[#5f5f5f]">
              Выбери тему — прочитаешь подробно о себе по ней. Это продолжение твоего разбора.
            </p>
          )}

          <div className="mt-4">
            {isPremium ? (
              HUMAN_MAP_SECTION_KEYS.map((key, i) => (
                <PaidTopicCard
                  key={key}
                  sectionKey={key}
                  index={i}
                  isLoading={paidLoading === key}
                  expanded={expandedKey === key}
                  reading={paidSections[key]}
                  onToggle={() => toggleTopic(key)}
                />
              ))
            ) : (
              <>
                {HUMAN_MAP_SECTION_KEYS.map((key) => (
                  <PremiumTopicTeaser
                    key={key}
                    sectionKey={key}
                    onClick={() => handleOpenPaid(key)}
                  />
                ))}
                <div className="mt-6 overflow-hidden natal-premium-card p-5">
                  <h3 className="font-sans text-[19px] font-semibold leading-tight">Открой все 10 разделов</h3>
                  <p className="mt-1.5 text-[13px] leading-relaxed text-[#667085]">
                    Любовь, деньги, работа, тень, сила и предназначение — подробно по твоей карте.
                  </p>
                  <button
                    type="button"
                    onClick={requestPremium}
                    className="mt-4 flex w-full items-center justify-center gap-2 natal-premium-button px-5 py-2.5 text-[14px] font-semibold"
                  >
                    <Crown size={16} strokeWidth={2} />
                    Открыть в Premium
                  </button>
                </div>
              </>
            )}
          </div>
        </section>

        {sectionError ? (
          <p className="border-t border-[#eeeeee] py-4 text-[13px] leading-relaxed text-[#b05c5c]">{sectionError}</p>
        ) : null}

        <section className="border-t border-[#eeeeee] py-6">
          <p className="font-sans text-[12.5px] leading-relaxed text-[#777]">
            Это ознакомательная интерпретация на основе астрологических расчетов по вашим данным рождения. Она не является прямым указанием к действию и не заменяет медицинские, юридические, финансовые или иные профессиональные рекомендации.
          </p>
        </section>

        <TechnicalDetails chartData={chartData} />
      </div>

      {unlockTarget ? (
        <NatalUnlockSheet
          sectionKey={unlockTarget}
          isLoading={paidLoading === unlockTarget}
          onClose={() => setUnlockTarget(null)}
          onPremium={() => {
            setUnlockTarget(null);
            requestPremium();
          }}
        />
      ) : null}

    </article>
  );
};
