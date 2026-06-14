import React, { memo, useEffect, useMemo, useState } from 'react';
import type { ForecastDailyReading, NatalChartData, UserProfile } from '../../types';
import { getZodiacSign } from '../../constants';
import { getMoscowTodayKey, formatLumiaDate } from '../../lib/date-utils';
import { lumiaSelectionHaptic } from '../../lib/haptics';
import { getCachedDailySignHoroscope, ensureDailySignHoroscope } from '../../services/astrologyService';
import { saveProfile } from '../../services/storageService';
import {
  MonoArticle,
  MonoArticleSection,
  MonoPage,
  MonoShareBar,
  MonoStagger,
  MonoStaggerItem,
  MonoTag,
} from '../../components/mono-ui';
import { MonoIllustHoroscope } from '../../components/mono-ui/MonoIllustrations';
import { LzSignPickerSheet } from '../../components/lumia-ui/v2/LzSignPickerSheet';
import { ZODIAC_KEYS, type ZodiacKey } from '../../lib/horoscope/signDaily';

const LOCAL_SIGN_KEY = 'lumia:selected-zodiac-sign';

export type HoroscopeReaderProps = {
  profile: UserProfile;
  chartData: NatalChartData | null;
  chartId?: number | null;
  onUpdateProfile?: (profile: UserProfile) => void;
  onOpenChart?: () => void;
  onOpenPersonalDaily?: () => void;
  onRequestPremium?: () => void;
};

export const HoroscopeReader = memo<HoroscopeReaderProps>(({ profile, chartData, onUpdateProfile }) => {
  const language = profile.language === 'en' ? 'en' : 'ru';
  const today = useMemo(() => getMoscowTodayKey(), []);
  const initialSign = useMemo(() => {
    const fromProfile = String(profile.selectedZodiacSign || chartData?.sun?.sign || '').trim();
    return ZODIAC_KEYS.find((s) => s.toLowerCase() === fromProfile.toLowerCase()) || ZODIAC_KEYS[0];
  }, [profile.selectedZodiacSign, chartData]);

  const [sign, setSign] = useState<ZodiacKey>(initialSign);
  const [reading, setReading] = useState<ForecastDailyReading | null>(null);
  const [loading, setLoading] = useState(true);
  const [pickerOpen, setPickerOpen] = useState(false);

  useEffect(() => {
    setSign(initialSign);
  }, [initialSign]);

  useEffect(() => {
    let alive = true;
    setLoading(true);
    void getCachedDailySignHoroscope(sign, today, language)
      .then((cached) => cached || ensureDailySignHoroscope(sign, today, language))
      .then((result) => {
        if (alive) setReading(result);
      })
      .catch(() => {
        if (alive) setReading(null);
      })
      .finally(() => {
        if (alive) setLoading(false);
      });
    return () => {
      alive = false;
    };
  }, [language, sign, today]);

  const chooseSign = (picked: string) => {
    const normalized = ZODIAC_KEYS.find((s) => s.toLowerCase() === picked.toLowerCase());
    if (!normalized) return;
    lumiaSelectionHaptic();
    setSign(normalized);
    try {
      window.localStorage.setItem(LOCAL_SIGN_KEY, normalized);
    } catch {
      /* optional */
    }
    const updated = { ...profile, selectedZodiacSign: normalized };
    onUpdateProfile?.(updated);
    if (updated.id) void saveProfile(updated).catch(() => undefined);
  };

  const signLabel = getZodiacSign(language, sign);
  const kicker = `${signLabel} · ${language === 'ru' ? 'сегодня' : 'today'}`;

  return (
    <>
      <MonoPage className="px-0" withTabClearance>
        <MonoStagger>
          <MonoStaggerItem>
            <div className="flex items-center justify-between px-4 pt-2">
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-mono-muted">{kicker}</p>
                <h1 className="mt-1 font-lora text-[28px] font-bold leading-tight text-mono-ink">
                  {reading?.headline || (language === 'ru' ? 'Гороскоп дня' : 'Daily horoscope')}
                </h1>
              </div>
              <button
                type="button"
                onClick={() => setPickerOpen(true)}
                className="rounded-full border border-mono-line bg-mono-white px-3.5 py-2 text-[13px] font-semibold text-mono-ink"
              >
                {language === 'ru' ? 'Знак' : 'Sign'}
              </button>
            </div>
          </MonoStaggerItem>

          <MonoStaggerItem>
            <div className="relative mx-4 mt-4 overflow-hidden rounded-mono-card bg-mono-plate px-5 py-8">
              <MonoIllustHoroscope className="mx-auto opacity-90" size={120} />
            </div>
          </MonoStaggerItem>

          <MonoStaggerItem>
            <MonoArticle
              kicker={formatLumiaDate(today, language)}
              title={reading?.headline || signLabel}
              lead={loading ? (language === 'ru' ? 'Готовим разбор…' : 'Preparing reading…') : reading?.summary}
              serif
              className="pb-28"
            >
              {reading?.reading ? (
                <MonoArticleSection title={language === 'ru' ? 'Подробнее' : 'More'}>{reading.reading}</MonoArticleSection>
              ) : null}
              {reading?.focus ? (
                <MonoArticleSection title={language === 'ru' ? 'Фокус дня' : 'Focus'}>{reading.focus}</MonoArticleSection>
              ) : null}
              {reading?.chance ? (
                <MonoArticleSection title={language === 'ru' ? 'Шанс' : 'Opportunity'}>{reading.chance}</MonoArticleSection>
              ) : null}
              {reading?.risk ? (
                <MonoArticleSection title={language === 'ru' ? 'Осторожно' : 'Watch out'}>{reading.risk}</MonoArticleSection>
              ) : null}
              {reading?.advice?.length ? (
                <MonoArticleSection title={language === 'ru' ? 'Советы' : 'Advice'}>
                  <ul className="space-y-2">
                    {reading.advice.slice(0, 3).map((item) => (
                      <li key={item}>{item}</li>
                    ))}
                  </ul>
                </MonoArticleSection>
              ) : null}
              {reading?.context ? (
                <p className="text-[13px] leading-relaxed text-mono-muted">{reading.context}</p>
              ) : null}
              <div className="flex flex-wrap gap-2 pt-2">
                <MonoTag>{signLabel}</MonoTag>
                <MonoTag>{language === 'ru' ? 'ежедневно' : 'daily'}</MonoTag>
              </div>
            </MonoArticle>
          </MonoStaggerItem>
        </MonoStagger>

        <MonoShareBar
          label={language === 'ru' ? 'Поделиться' : 'Share'}
          onShare={() => {
            try {
              const tg = (window as unknown as { Telegram?: { WebApp?: { openTelegramLink?: (url: string) => void } } })
                .Telegram?.WebApp;
              tg?.openTelegramLink?.(`https://t.me/share/url?url=${encodeURIComponent('https://t.me/lumia_astrology_bot')}`);
            } catch {
              /* optional */
            }
          }}
        />
      </MonoPage>

      <LzSignPickerSheet
        open={pickerOpen}
        language={language}
        current={sign}
        onPick={chooseSign}
        onClose={() => setPickerOpen(false)}
      />
    </>
  );
});

HoroscopeReader.displayName = 'HoroscopeReader';
