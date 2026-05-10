import React, { useEffect, useMemo, useState } from 'react';
import { ChevronDown, Lock, Sparkles } from 'lucide-react';
import type {
  InterpretationSection,
  NatalChartData,
  NatalInterpretationReport,
  UserProfile,
} from '../../types';
import {
  HUMAN_DAILY_SECTION_KEYS,
  HUMAN_DAILY_SECTION_META,
  HUMAN_PAID_LUMI_COST,
  HUMAN_PAID_SECTION_KEYS,
  HUMAN_PAID_SECTION_META,
  type HumanDailySectionKey,
  type HumanPaidSectionKey,
} from '../../lib/natalHumanShared';
import { getMoscowTodayKey } from '../../lib/date-utils';
import {
  loadHumanBaseReport,
  loadHumanDailySection,
  loadHumanPaidSection,
  type HumanReadingError,
} from '../../services/natalReadingService';
import { PlanetIcon } from '../icons/PlanetIcon';
import { getNatalReadingBackground } from '../../lib/visualBackgrounds';

type Props = {
  profile: UserProfile;
  chartData: NatalChartData;
  chartId?: number;
  requestPremium: () => void;
  onUpdateProfile?: (profile: UserProfile) => void;
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
  if (e?.code === 'INSUFFICIENT_LUMI') {
    return `Недостаточно Lumi. Нужно ${e.lumiCost ?? HUMAN_PAID_LUMI_COST}, сейчас ${e.lumiBalance ?? 0}.`;
  }
  if (e?.code === 'PREMIUM_REQUIRED') return 'Этот раздел доступен в Premium.';
  if (e?.message) return e.message;
  return 'Не удалось загрузить раздел. Попробуйте еще раз.';
}

const SectionText: React.FC<{ section: InterpretationSection }> = ({ section }) => {
  const background = getNatalReadingBackground(section.key);

  return (
    <section
      data-reading-section-key={section.key}
      className="relative -mx-5 overflow-hidden border-t border-[#efefef] px-5 py-7 first:border-t-0 sm:py-8"
    >
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 z-0 bg-cover bg-center"
        style={{
          backgroundImage: `linear-gradient(180deg, rgba(255,255,255,0.82) 0%, rgba(255,255,255,0.92) 46%, rgba(255,255,255,0.985) 100%), url(${background})`,
        }}
      />
      <div className="relative z-10">
        <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-[#8c6bb1]">
          {section.subtitle || section.title}
        </p>
        <h3 className="mt-2 font-lora text-[22px] leading-tight text-[#1f1f1f]">{section.title}</h3>
        <p className="mt-4 whitespace-pre-line font-lora text-[15px] leading-[1.85] text-[#2d2d2d]">
          {section.content}
        </p>
        {section.bullets && section.bullets.length > 0 ? (
          <ul className="mt-5 space-y-2.5">
            {section.bullets.map((item, index) => (
              <li key={`${section.key}-${index}`} className="flex gap-2.5 text-[14px] leading-relaxed text-[#333]">
                <span className="mt-[8px] h-[5px] w-[5px] shrink-0 rounded-full bg-[#c9a55a]" />
                <span>{item}</span>
              </li>
            ))}
          </ul>
        ) : null}
      </div>
    </section>
  );
};

const PaidSectionCard: React.FC<{
  sectionKey: HumanPaidSectionKey;
  isPremium: boolean;
  isLoading: boolean;
  opened?: InterpretationSection;
  onOpen: () => void;
}> = ({ sectionKey, isPremium, isLoading, opened, onOpen }) => {
  const meta = HUMAN_PAID_SECTION_META[sectionKey];
  if (opened) {
    return (
      <div className="border-t border-[#efefef] py-6">
        <SectionText section={opened} />
      </div>
    );
  }
  return (
    <button
      type="button"
      onClick={onOpen}
      disabled={isLoading}
      className="group w-full border-t border-[#efefef] py-5 text-left transition disabled:opacity-60"
    >
      <div className="flex items-start gap-3">
        <span className="mt-1 flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#f7f5fb] text-[#6f4ea8]">
          <Lock size={15} strokeWidth={1.7} />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block font-lora text-[18px] leading-tight text-[#1f1f1f]">{meta.title}</span>
          <span className="mt-1.5 block text-[13.5px] leading-relaxed text-[#5e5e5e]">{meta.teaser}</span>
          <span className="mt-3 inline-flex items-center rounded-full bg-[#f7f7f7] px-3 py-1 text-[12px] text-[#3a3a3a]">
            {isLoading ? 'Готовим раздел...' : isPremium ? 'Открыть раздел' : `Открыть за ${HUMAN_PAID_LUMI_COST} Lumi`}
          </span>
        </span>
      </div>
    </button>
  );
};

const DailySectionButton: React.FC<{
  sectionKey: HumanDailySectionKey;
  isPremium: boolean;
  isLoading: boolean;
  opened?: InterpretationSection;
  onOpen: () => void;
}> = ({ sectionKey, isPremium, isLoading, opened, onOpen }) => {
  const meta = HUMAN_DAILY_SECTION_META[sectionKey];
  const background = getNatalReadingBackground(sectionKey);
  return (
    <div className="relative -mx-5 overflow-hidden border-t border-[#efefef] px-5 py-5">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 z-0 bg-cover bg-center"
        style={{
          backgroundImage: `linear-gradient(180deg, rgba(255,255,255,0.86) 0%, rgba(255,255,255,0.94) 56%, rgba(255,255,255,0.99) 100%), url(${background})`,
        }}
      />
      <div className="relative z-10">
        <button
        type="button"
        onClick={onOpen}
        disabled={isLoading}
        className="flex w-full items-start justify-between gap-4 text-left disabled:opacity-60"
      >
        <span>
          <span className="block font-lora text-[17px] leading-tight text-[#1f1f1f]">{meta.title}</span>
          <span className="mt-1.5 block text-[13.5px] leading-relaxed text-[#666]">
            {opened ? opened.subtitle || meta.subtitle : meta.teaser}
          </span>
        </span>
        <span className="mt-1 shrink-0 rounded-full bg-[#f7f5fb] px-3 py-1 text-[12px] text-[#6f4ea8]">
          {isLoading ? '...' : isPremium ? 'Открыть' : 'Premium'}
        </span>
        </button>
        {opened ? (
          <div className="mt-4">
          <p className="whitespace-pre-line font-lora text-[14.5px] leading-[1.8] text-[#2d2d2d]">{opened.content}</p>
          {opened.bullets?.length ? (
            <div className="mt-4 flex flex-wrap gap-2">
              {opened.bullets.map((item, index) => (
                <span key={`${opened.key}-${index}`} className="rounded-full bg-[#f6f6f6] px-3 py-1 text-[12px] text-[#3a3a3a]">
                  {item}
                </span>
              ))}
            </div>
          ) : null}
          </div>
        ) : null}
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
    <details className="border-t border-[#efefef] py-6">
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
}) => {
  const [report, setReport] = useState<NatalInterpretationReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [paidSections, setPaidSections] = useState<Partial<Record<HumanPaidSectionKey, InterpretationSection>>>({});
  const [dailySections, setDailySections] = useState<Partial<Record<HumanDailySectionKey, InterpretationSection>>>({});
  const [paidLoading, setPaidLoading] = useState<HumanPaidSectionKey | null>(null);
  const [dailyLoading, setDailyLoading] = useState<HumanDailySectionKey | null>(null);
  const [sectionError, setSectionError] = useState<string | null>(null);

  const userId = profile.id ? String(profile.id) : '';
  const isPremium = !!profile.isPremium;
  const todayKey = useMemo(() => getMoscowTodayKey(), []);

  useEffect(() => {
    if (!userId) return;
    let cancelled = false;
    setLoading(true);
    setError(null);
    loadHumanBaseReport(userId, chartId)
      .then((result) => {
        if (!cancelled) setReport(result);
      })
      .catch((err) => {
        if (!cancelled) setError(formatError(err));
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [chartId, userId]);

  const handleOpenPaid = async (key: HumanPaidSectionKey) => {
    if (!userId || paidLoading) return;
    setSectionError(null);

    const allowLumiSpend = !isPremium;
    if (allowLumiSpend) {
      const balance = profile.lumiBalance ?? 0;
      if (balance < HUMAN_PAID_LUMI_COST) {
        setSectionError(`Для раздела нужно ${HUMAN_PAID_LUMI_COST} Lumi. Сейчас на балансе ${balance}.`);
        return;
      }
      const ok = window.confirm(`Открыть раздел "${HUMAN_PAID_SECTION_META[key].title}" за ${HUMAN_PAID_LUMI_COST} Lumi?`);
      if (!ok) return;
    }

    setPaidLoading(key);
    try {
      const result = await loadHumanPaidSection(userId, key, chartId, {
        accessTier: allowLumiSpend ? 'lumi' : 'premium',
        allowLumiSpend,
      });
      setPaidSections((current) => ({ ...current, [key]: result.content }));
      if (typeof result.lumiBalance === 'number') {
        onUpdateProfile?.({ ...profile, lumiBalance: result.lumiBalance });
      }
    } catch (err) {
      setSectionError(formatError(err));
    } finally {
      setPaidLoading(null);
    }
  };

  const handleOpenDaily = async (key: HumanDailySectionKey) => {
    if (!isPremium) {
      requestPremium();
      return;
    }
    if (!userId || dailyLoading) return;
    setSectionError(null);
    setDailyLoading(key);
    try {
      const result = await loadHumanDailySection(userId, key, chartId, todayKey);
      setDailySections((current) => ({ ...current, [key]: result.content }));
    } catch (err) {
      setSectionError(formatError(err));
    } finally {
      setDailyLoading(null);
    }
  };

  if (loading) {
    return (
      <div className="px-5 py-10">
        <p className="text-[11px] uppercase tracking-[0.22em] text-[#9a9a9a]">Готовим новую интерпретацию</p>
        <div className="mt-5 space-y-3">
          {Array.from({ length: 5 }).map((_, index) => (
            <div key={index} className="h-4 rounded-full bg-[#f1f1f1]" style={{ width: `${92 - index * 9}%` }} />
          ))}
        </div>
      </div>
    );
  }

  if (error || !report) {
    return (
      <div className="px-5 py-10">
        <p className="font-lora text-[20px] text-[#1f1f1f]">Интерпретация сейчас недоступна</p>
        <p className="mt-2 text-sm leading-relaxed text-[#666]">{error || 'Обновите экран через несколько секунд.'}</p>
        <button
          type="button"
          onClick={() => window.location.reload()}
          className="mt-5 rounded-full bg-[#1f1f1f] px-5 py-2.5 text-[13px] text-white"
        >
          Обновить
        </button>
      </div>
    );
  }

  return (
    <article
      className="bg-white px-5 pb-16 pt-6"
      style={{
        backgroundImage: `linear-gradient(180deg, rgba(255,255,255,0.78) 0%, rgba(255,255,255,0.94) 34%, rgba(255,255,255,1) 72%), url(${getNatalReadingBackground('base_portrait')})`,
        backgroundPosition: 'center top',
        backgroundRepeat: 'no-repeat',
        backgroundSize: 'cover',
      }}
    >
      <header className="pb-7">
        <p className="text-[11px] uppercase tracking-[0.22em] text-[#9a9a9a]">
          {report.birthData.birthDate}
          {report.birthData.birthTime ? ` · ${report.birthData.birthTime}` : ''}
          {report.birthData.birthPlace ? ` · ${report.birthData.birthPlace}` : ''}
        </p>
        <h1 className="mt-3 font-lora text-[29px] leading-[1.12] text-[#1f1f1f]">
          {report.userName}, главный портрет
        </h1>
        <div className="mt-5 border-l-2 border-[#c9a55a] pl-4">
          <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-[#8c6bb1]">
            {report.shortCard.title || 'Главная энергия карты'}
          </p>
          <p className="mt-2 font-lora text-[16px] leading-[1.65] text-[#2d2d2d]">{report.shortCard.text}</p>
          <div className="mt-3 flex flex-wrap gap-2">
            {report.shortCard.keywords.map((keyword) => (
              <span key={keyword} className="rounded-full bg-[#f7f7f7] px-3 py-1 text-[12px] text-[#3a3a3a]">
                {keyword}
              </span>
            ))}
          </div>
          <p className="mt-3 text-[13.5px] italic leading-relaxed text-[#666]">{report.shortCard.advice}</p>
        </div>
      </header>

      <div>
        {report.freeSections.map((section) => (
          <SectionText key={section.key} section={section} />
        ))}
      </div>

      <section className="border-t border-[#efefef] py-8">
        <div className="flex items-start gap-3">
          <span className="mt-1 text-[#c9a55a]">
            <Sparkles size={18} strokeWidth={1.7} />
          </span>
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-[#8c6bb1]">
              Полный разбор
            </p>
            <h2 className="mt-2 font-lora text-[24px] leading-tight text-[#1f1f1f]">
              Как карта проявляется в жизни
            </h2>
            <p className="mt-3 text-[14px] leading-relaxed text-[#5e5e5e]">
              Ниже - сферы, где карта становится практичной: отношения, работа, деньги, действия, окружение и личный рост.
            </p>
          </div>
        </div>

        <div className="mt-5">
          {HUMAN_PAID_SECTION_KEYS.map((key) => (
            <PaidSectionCard
              key={key}
              sectionKey={key}
              isPremium={isPremium}
              isLoading={paidLoading === key}
              opened={paidSections[key]}
              onOpen={() => handleOpenPaid(key)}
            />
          ))}
        </div>
      </section>

      <section className="border-t border-[#efefef] py-8">
        <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-[#8c6bb1]">Ежедневная интерпретация</p>
        <h2 className="mt-2 font-lora text-[24px] leading-tight text-[#1f1f1f]">Карта сегодня</h2>
        <p className="mt-3 text-[14px] leading-relaxed text-[#5e5e5e]">
          Каждый день карта оживает через текущие транзиты: где фокус, где риск, что лучше сделать и как бережнее пройти день.
        </p>

        <div className="mt-5">
          {HUMAN_DAILY_SECTION_KEYS.map((key) => (
            <DailySectionButton
              key={key}
              sectionKey={key}
              isPremium={isPremium}
              isLoading={dailyLoading === key}
              opened={dailySections[key]}
              onOpen={() => handleOpenDaily(key)}
            />
          ))}
        </div>

        {!isPremium ? (
          <button
            type="button"
            onClick={requestPremium}
            className="mt-5 w-full rounded-full bg-[#1f1f1f] px-5 py-3 text-[13px] font-medium text-white"
          >
            Открыть Premium
          </button>
        ) : null}
      </section>

      {sectionError ? (
        <p className="border-t border-[#efefef] py-4 text-[13px] leading-relaxed text-[#b05c5c]">{sectionError}</p>
      ) : null}

      <TechnicalDetails chartData={chartData} />
    </article>
  );
};
