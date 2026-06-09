import React, { useEffect, useMemo, useState } from 'react';
import { ChevronDown, Crown, Lock, Sparkles, X } from 'lucide-react';
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

type Props = {
  profile: UserProfile;
  chartData: NatalChartData;
  chartId?: number;
  requestPremium: () => void;
  onUpdateProfile?: (profile: UserProfile) => void;
  preloadedReport?: NatalInterpretationReport | null;
  onOpenPersonalDaily?: () => void;
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

const SectionText: React.FC<{ section: InterpretationSection }> = ({ section }) => (
  <section data-reading-section-key={section.key} className="border-t border-[#eeeeee] py-8 first:border-t-0 sm:py-10">
    <p className="font-sans text-[11px] font-semibold uppercase tracking-[0.18em] text-[#8c6bb1]">
      {section.subtitle || section.title}
    </p>
    <h3 className="mt-2 font-sans text-[26px] font-semibold leading-[1.08] tracking-[-0.02em] text-[#1f1f1f] sm:text-[30px]">
      {section.title}
    </h3>
    <div className="mt-5">
      <FormattedAiText
        text={section.content}
        variant="article"
        className="max-w-none"
        paragraphClassName="font-sans text-[16.5px] leading-[1.82] text-[#2d2d2d] [text-wrap:pretty] sm:text-[17.5px] sm:leading-[1.9]"
      />
    </div>
    {section.bullets?.length ? (
      <ul className="mt-6 space-y-3 border-l-2 border-[#d8c18a] pl-4">
        {section.bullets.map((item, index) => (
          <li key={`${section.key}-${index}`} className="font-sans text-[14.5px] leading-relaxed text-[#3a3a3a]">
            {item}
          </li>
        ))}
      </ul>
    ) : null}
  </section>
);

const LockedPreview: React.FC<{
  sectionKey: HumanPaidSectionKey;
  isLoading: boolean;
  opened?: InterpretationSection;
  onOpen: () => void;
}> = ({ sectionKey, isLoading, opened, onOpen }) => {
  const meta = HUMAN_PAID_SECTION_META[sectionKey];

  if (opened) {
    return <SectionText section={opened} />;
  }

  return (
    <button
      type="button"
      onClick={onOpen}
      disabled={isLoading}
      className="group w-full border-t border-[#eeeeee] py-6 text-left transition disabled:opacity-60"
    >
      <div className="flex items-start gap-3">
        <span className="mt-1 flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#f6f1fb] text-[#7150a7]">
          <Lock size={15} strokeWidth={1.9} />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block font-sans text-[19px] font-semibold leading-tight tracking-[-0.01em] text-[#1f1f1f]">
            {meta.title}
          </span>
          <span className="mt-2 block font-sans text-[14px] leading-relaxed text-[#626262]">{meta.teaser}</span>
          <span className="relative mt-4 block max-h-[4.8rem] overflow-hidden rounded-[18px] bg-[#fafafa] px-4 py-3">
            <span className="block select-none font-sans text-[14px] leading-[1.65] text-[#2f2f2f] blur-[2.5px]">
              В полном разборе здесь будет личный текст о том, как эта тема проявляется именно в вашей карте:
              где сила, что может мешать и как с этим обращаться без давления на себя.
            </span>
            <span className="pointer-events-none absolute inset-0 bg-gradient-to-b from-white/10 via-white/45 to-white" />
          </span>
          <span className="mt-4 inline-flex items-center gap-2 rounded-full bg-[#1f1f1f] px-4 py-2 text-[13px] font-medium text-white">
            <Sparkles size={14} strokeWidth={2} />
            {isLoading ? 'Открываем...' : 'Прочитать все о себе'}
          </span>
        </span>
      </div>
    </button>
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

        <p className="font-sans text-[11px] font-semibold uppercase tracking-[0.18em] text-[#8c6bb1]">Полный раздел карты</p>
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
  onUpdateProfile,
  preloadedReport,
  onOpenPersonalDaily,
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

  return (
    <article className="relative bg-white pb-16 pt-6">
      <div className="relative z-10 mx-auto w-full max-w-reading-wide px-5">
        <header className="pb-8">
          <p className="font-sans text-[11px] font-semibold uppercase tracking-[0.18em] text-[#8c6bb1]">
            Натальная карта
          </p>
          <h1 className="mt-3 font-sans text-[36px] font-semibold leading-[1.02] tracking-[-0.035em] text-[#1f1f1f] sm:text-[44px]">
            {report?.userName || profile.name || 'Твоя карта'}, главный портрет
          </h1>
          <p className="mt-4 max-w-[36rem] font-sans text-[15px] leading-relaxed text-[#666]">
            Разбор основан на дате, времени и месте рождения. Сейчас открыт общий портрет, а подробные темы доступны в Premium.
          </p>
          <p className="mt-3 font-sans text-[12.5px] leading-relaxed text-[#888]">
            {report?.birthData.birthDate || profile.birthDate}
            {(report?.birthData.birthTime || profile.birthTime) ? ` · ${report?.birthData.birthTime || profile.birthTime}` : ''}
            {(report?.birthData.birthPlace || profile.birthPlace) ? ` · ${report?.birthData.birthPlace || profile.birthPlace}` : ''}
          </p>
          {((chartData as any).birthTimeQuality === 'unknown' || (chartData as any).chartQuality?.ascendantReliable === false) ? (
            <p className="mt-3 rounded-[16px] bg-[#faf7ef] px-4 py-3 font-sans text-[13px] leading-relaxed text-[#6f6654]">
              Время рождения указано неточно, поэтому Асцендент и дома могут отличаться. Солнце, Луна и общий портрет остаются полезной основой.
            </p>
          ) : null}

          <div className="mt-7 border-l-2 border-[#d8c18a] pl-4">
            <p className="font-sans text-[11px] font-semibold uppercase tracking-[0.18em] text-[#8c6bb1]">
              {report?.shortCard.title || 'Основа твоей карты'}
            </p>
            <p className="mt-3 font-sans text-[17px] leading-[1.75] text-[#2d2d2d] [text-wrap:pretty]">
              {report?.shortCard.text || `Солнце в знаке ${ruSign(chartData.sun?.sign)}, Луна в знаке ${ruSign(chartData.moon?.sign)}, Асцендент в знаке ${ruSign(chartData.rising?.sign)}.`}
            </p>
            {report ? (
              <>
                <div className="mt-4 flex flex-wrap gap-2">
                  {report.shortCard.keywords.map((keyword) => (
                    <span key={keyword} className="rounded-full bg-[#f7f7f7] px-3 py-1 text-[12px] text-[#3a3a3a]">
                      {keyword}
                    </span>
                  ))}
                </div>
                <p className="mt-4 font-sans text-[14px] italic leading-relaxed text-[#666]">{report.shortCard.advice}</p>
              </>
            ) : null}
          </div>
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
            visibleFreeSections.map((section) => (
              <SectionText key={section.key} section={{ ...section, title: section.key === 'base_portrait' ? 'Кто ты по карте' : section.title }} />
            ))
          )}
        </div>

        <section className="border-t border-[#eeeeee] py-7">
          <button type="button" onClick={onOpenPersonalDaily} className="w-full rounded-[20px] bg-[#f7f4fb] px-5 py-4 text-left">
            <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[#8c6bb1]">Личный день</p>
            <h2 className="mt-2 text-[21px] font-semibold text-[#1f1f1f]">Что с тобой сегодня</h2>
            <p className="mt-2 text-[14px] leading-relaxed text-[#626262]">Текущий личный фон, действие и риск дня — по твоей карте.</p>
          </button>
        </section>

        <section className="border-t border-[#eeeeee] py-9">
          <div className="flex items-start gap-3">
            <span className="mt-1 text-[#c9a55a]">
              <Sparkles size={18} strokeWidth={1.8} />
            </span>
            <div>
              <p className="font-sans text-[11px] font-semibold uppercase tracking-[0.18em] text-[#8c6bb1]">Полный разбор</p>
              <h2 className="mt-2 font-sans text-[28px] font-semibold leading-[1.08] tracking-[-0.02em] text-[#1f1f1f]">
                Подробные темы полной карты
              </h2>
              <p className="mt-3 font-sans text-[14.5px] leading-relaxed text-[#5e5e5e]">
                Здесь общий разбор переходит в конкретные сферы: отношения, работа, деньги, дом, общение, решения и повторяющиеся сценарии.
              </p>
            </div>
          </div>

          <div className="mt-6">
            {HUMAN_MAP_SECTION_KEYS.map((key) => (
              <LockedPreview
                key={key}
                sectionKey={key}
                isLoading={paidLoading === key}
                opened={paidSections[key]}
                onOpen={() => handleOpenPaid(key)}
              />
            ))}
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
