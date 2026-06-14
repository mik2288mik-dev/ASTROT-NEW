import React, { memo, useEffect, useMemo, useState } from 'react';
import type { ForecastDailyReading, NatalChartData, UserProfile } from '../../types';
import { getZodiacSign } from '../../constants';
import { getMoscowTodayKey, formatLumiaDate } from '../../lib/date-utils';
import { lumiaSelectionHaptic } from '../../lib/haptics';
import { getLzArtSrc } from '../../lib/lzArtAssets';
import { getCachedDailySignHoroscope, ensureDailySignHoroscope } from '../../services/astrologyService';
import { saveProfile } from '../../services/storageService';
import {
  MonoArticleSection,
  MonoPage,
  MonoShareBar,
  MonoStagger,
  MonoStaggerItem,
  MonoTag,
} from '../../components/mono-ui';
import { MonoIllustHoroscope } from '../../components/mono-ui/MonoIllustrations';
import { LzArtPlate } from '../../components/lumia-ui/v2/LzArtPlate';
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

  return (
    <>
      <MonoPage className="lz-reader-page px-0" withTabClearance>
        <MonoStagger>
          <MonoStaggerItem>
            <div className="px-4 pt-1">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="lz-kicker">{signLabel} · {language === 'ru' ? 'сегодня' : 'today'}</p>
                  <h1 className="mt-1 font-lora text-[clamp(1.6rem,6vw,2rem)] font-bold leading-[1.08] tracking-[-0.02em] text-mono-ink">
                    {reading?.headline || (language === 'ru' ? 'Гороскоп дня' : 'Daily horoscope')}
                  </h1>
                  <p className="mt-2 text-[13px] font-medium text-mono-muted">{formatLumiaDate(today, language)}</p>
                </div>
                <button
                  type="button"
                  onClick={() => setPickerOpen(true)}
                  className="lz-sign-chip shrink-0"
                >
                  {language === 'ru' ? 'Знак' : 'Sign'}
                </button>
              </div>
            </div>
          </MonoStaggerItem>

          <MonoStaggerItem>
            <div className="mt-4 px-4">
              <LzArtPlate
                imageSrc={getLzArtSrc('readerHero')}
                fallback={<MonoIllustHoroscope size={128} className="opacity-90" />}
                aspect="hero"
              />
            </div>
          </MonoStaggerItem>

          <MonoStaggerItem>
            <article className="px-4 pb-36 pt-6">
              <p className="text-[17px] leading-[1.65] text-mono-ink/92">
                {loading
                  ? (language === 'ru' ? 'Готовим разбор…' : 'Preparing reading…')
                  : reading?.summary}
              </p>

              <div className="mt-6 space-y-4">
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
              </div>

              <div className="mt-6 flex flex-wrap gap-2">
                <MonoTag>{signLabel}</MonoTag>
                <MonoTag>{language === 'ru' ? 'ежедневно' : 'daily'}</MonoTag>
              </div>
            </article>
          </MonoStaggerItem>
        </MonoStagger>

        <MonoShareBar
          label={language === 'ru' ? 'Поделиться' : 'Share'}
          withTabClearance
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
