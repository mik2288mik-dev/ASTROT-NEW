import React, { memo, useEffect, useMemo, useState } from 'react';
import type { ForecastDailyReading, NatalChartData, UserProfile } from '../../types';
import { getZodiacSign } from '../../constants';
import { getMoscowTodayKey, formatLumiaDate } from '../../lib/date-utils';
import { lumiaSelectionHaptic } from '../../lib/haptics';
import { getCachedDailySignHoroscope, ensureDailySignHoroscope } from '../../services/astrologyService';
import { saveProfile } from '../../services/storageService';
import {
  MonoArticleSection,
  MonoShareBar,
  MonoTag,
} from '../../components/mono-ui';
import { MonoIllustHoroscope } from '../../components/mono-ui/MonoIllustrations';
import { FreshHeroCard } from '../../components/fresh-ui';
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
      <div className="fresh-page">
        {/* Шапка: знак · сегодня + заголовок + чип выбора знака */}
        <div
          className="fresh-page-title-block"
          style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 }}
        >
          <div style={{ minWidth: 0 }}>
            <div className="fresh-page-kicker">
              {signLabel} · {language === 'ru' ? 'сегодня' : 'today'}
            </div>
            <div className="fresh-page-title">
              {reading?.headline || (language === 'ru' ? 'Гороскоп дня' : 'Daily horoscope')}
            </div>
            <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--fresh-muted)', marginTop: 6 }}>
              {formatLumiaDate(today, language)}
            </div>
          </div>
          <button
            type="button"
            onClick={() => {
              lumiaSelectionHaptic();
              setPickerOpen(true);
            }}
            style={{
              flexShrink: 0,
              background: 'var(--fresh-surface)',
              border: 'none',
              borderRadius: 'var(--fresh-radius-pill)',
              padding: '8px 14px',
              fontSize: 13,
              fontWeight: 700,
              color: 'var(--fresh-text)',
              cursor: 'pointer',
            }}
          >
            {language === 'ru' ? 'Знак' : 'Sign'}
          </button>
        </div>

        {/* Hero-карточка с иллюстрацией */}
        <FreshHeroCard color="sky" chipText={signLabel} chipPosition="top-right">
          <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <MonoIllustHoroscope size={120} className="opacity-90" />
          </div>
        </FreshHeroCard>

        {/* Статья */}
        <article style={{ padding: '6px 20px 28px' }}>
          <p style={{ fontSize: 17, lineHeight: 1.65, color: 'var(--fresh-text)' }}>
            {loading
              ? (language === 'ru' ? 'Готовим разбор…' : 'Preparing reading…')
              : reading?.summary}
          </p>

          <div className="space-y-4" style={{ marginTop: 24 }}>
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

          <div style={{ marginTop: 24, display: 'flex', flexWrap: 'wrap', gap: 8 }}>
            <MonoTag>{signLabel}</MonoTag>
            <MonoTag>{language === 'ru' ? 'ежедневно' : 'daily'}</MonoTag>
          </div>
        </article>

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
      </div>

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
