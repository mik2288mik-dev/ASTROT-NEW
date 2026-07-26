import React, { memo, useMemo, useState } from 'react';
import type { UserProfile } from '../types';
import { FreshTabs } from '../components/fresh-ui';
import { FreshInnerHeader } from '../components/fresh-ui/FreshHeaders';
import { lumiaSelectionHaptic } from '../lib/haptics';
import {
  FIXED_FORECAST_TOPIC_KEYS,
  FORECAST_OVERVIEW_TITLES,
  FORECAST_TOPIC_TITLES,
  type ForecastTopicKey,
  type ForecastTopicText,
  type PersonalForecastPackage,
} from '../lib/personalForecastContract';
import {
  buildForecastVisualRequests,
  forecastVisualStyle,
  resolveForecastVisualScreen,
} from '../lib/personalForecastVisuals';
import type { PersonalForecastSelection } from './Dashboard';

type PersonalForecastScreenProps = {
  profile: UserProfile;
  selection: PersonalForecastSelection;
  onBack: () => void | Promise<void>;
  requestPremium: (source?: string) => void | Promise<void>;
};

function topicText(
  forecast: PersonalForecastPackage,
  key: ForecastTopicKey,
): ForecastTopicText | null {
  if (FIXED_FORECAST_TOPIC_KEYS.includes(key as any)) {
    return forecast[key as keyof Pick<
      PersonalForecastPackage,
      'overview' | 'love' | 'work' | 'money' | 'mood_energy' | 'communication' | 'luck'
    >];
  }
  return forecast.dynamic.find((topic) => topic.key === key)?.text || null;
}

function paragraphs(value: string): string[] {
  const explicit = value
    .split(/\n{2,}/)
    .map((item) => item.trim())
    .filter(Boolean);
  if (explicit.length !== 1 || explicit[0].length < 360) return explicit;
  const sentences = explicit[0]
    .match(/[^.!?…]+(?:[.!?…]+[»”"']?|$)/g)
    ?.map((item) => item.trim())
    .filter(Boolean) || [];
  if (sentences.length < 4) return explicit;
  const midpoint = Math.ceil(sentences.length / 2);
  return [
    sentences.slice(0, midpoint).join(' '),
    sentences.slice(midpoint).join(' '),
  ].filter(Boolean);
}

function statusLabel(
  status: string,
  language: 'ru' | 'en',
): string {
  const labels = {
    ru: {
      applying: 'сходится',
      separating: 'расходится',
      exact: 'точный',
      active: 'действует',
      unknown: 'статус не определён',
    },
    en: {
      applying: 'applying',
      separating: 'separating',
      exact: 'exact',
      active: 'active',
      unknown: 'status unknown',
    },
  };
  return labels[language][status as keyof typeof labels.ru] || status;
}

export const PersonalForecastScreen = memo<PersonalForecastScreenProps>(({
  profile,
  selection,
  onBack,
  requestPremium,
}) => {
  const language: 'ru' | 'en' = profile.language === 'en' ? 'en' : 'ru';
  const forecast = selection.forecast;
  const [activeTopic, setActiveTopic] = useState<ForecastTopicKey>(selection.topicKey);
  const tabs = useMemo(() => [
    ...FIXED_FORECAST_TOPIC_KEYS.map((key) => ({
      id: key,
      label: FORECAST_TOPIC_TITLES[language][key],
    })),
    ...forecast.dynamic.map((topic) => ({
      id: topic.key,
      label: topic.title,
    })),
  ], [forecast.dynamic, language]);

  const dynamicKeySet = useMemo(
    () => new Set(forecast.dynamic.map((topic) => topic.key)),
    [forecast.dynamic],
  );
  const text = topicText(forecast, activeTopic);
  const activeLocked = activeTopic === selection.topicKey
    ? selection.locked
    : !text?.reading;
  const visual = useMemo(() => resolveForecastVisualScreen(
    buildForecastVisualRequests({
      userId: String(profile.id || 'guest'),
      period: forecast.period,
      periodKey: forecast.periodKey,
      dynamicTopicKeys: forecast.dynamic.map((topic) => topic.key),
    }),
  ), [forecast.dynamic, forecast.period, forecast.periodKey, profile.id]);
  const assignment = visual.assignments[
    activeTopic === 'overview'
      ? 'hero:overview'
      : `${dynamicKeySet.has(activeTopic as any) ? 'dynamic' : 'fixed'}:${activeTopic}`
  ];
  const evidence = (text?.astrology.evidence_ids || [])
    .map((id) => forecast.evidence[id])
    .filter(Boolean);
  const title = activeTopic === 'overview'
    ? FORECAST_OVERVIEW_TITLES[language][forecast.period]
    : tabs.find((tab) => tab.id === activeTopic)?.label
      || FORECAST_TOPIC_TITLES[language][activeTopic];
  const dateLabel = forecast.periodStart === forecast.periodEnd
    ? forecast.periodStart
    : `${forecast.periodStart} — ${forecast.periodEnd}`;

  return (
    <div className="fresh-page">
      <FreshInnerHeader
        title={language === 'ru' ? 'Личный прогноз' : 'Personal forecast'}
        subtitle={dateLabel}
        onBack={() => { void onBack(); }}
      />

      <FreshTabs
        tabs={tabs}
        activeTab={activeTopic}
        className="personal-daily-tabs"
        onTabChange={(id) => {
          lumiaSelectionHaptic();
          setActiveTopic(id as ForecastTopicKey);
        }}
      />

      <div className="personal-daily-content">
        <div
          className={`pd-areahero pd-areahero--${activeTopic}${assignment?.path ? ' has-card-background' : ' has-forecast-fallback'}`}
          style={forecastVisualStyle(assignment, forecast.period)}
        >
          <div className="pd-areahero-title">{title}</div>
          <div className="pd-areahero-sub">{text?.card || ''}</div>
        </div>

        {activeLocked ? (
          <div className="pd-notice">
            <span className="pd-notice-ico" aria-hidden>
              <svg width="18" height="18" viewBox="0 0 16 16" fill="none">
                <rect x="3.5" y="7" width="9" height="6.5" rx="1.5" stroke="currentColor" strokeWidth="1.4" />
                <path d="M5.5 7V5.5a2.5 2.5 0 0 1 5 0V7" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
              </svg>
            </span>
            <div className="pd-notice-title">
              {language === 'ru' ? 'Полный разбор доступен в Premium' : 'The full reading is available in Premium'}
            </div>
            <p className="pd-notice-body">
              {language === 'ru'
                ? 'Карточка остаётся видимой, а Premium открывает подробный вывод и расчёт.'
                : 'The card remains visible; Premium opens the detailed reading and calculation.'}
            </p>
            <button
              type="button"
              className="fresh-btn-primary"
              style={{ marginTop: 14, width: '100%' }}
              onClick={() => { lumiaSelectionHaptic(); void requestPremium('personal_forecast'); }}
            >
              {language === 'ru' ? 'Открыть Premium' : 'Open Premium'}
            </button>
          </div>
        ) : text ? (
          <div className="pd-body">
            <div className="natal-sec-body pd-reading-card">
              {paragraphs(text.reading).map((paragraph, index) => (
                <p key={index} className="natal-sec-p pd-reading-paragraph">{paragraph}</p>
              ))}
            </div>

            <section className="pd-reading-card" aria-labelledby="forecast-why-title">
              <h2 id="forecast-why-title" className="home-section-heading">
                {language === 'ru' ? 'Почему такой прогноз' : 'Why this forecast'}
              </h2>
              <p className="natal-sec-p pd-reading-paragraph">
                {text.astrology.explanation}
              </p>
            </section>

            <details className="pd-reading-card">
              <summary>
                {language === 'ru' ? 'Показать расчёт' : 'Show calculation'}
              </summary>
              <div>
                {evidence.map((item) => (
                  <article key={item.id} className="pd-point">
                    <strong>{item.factor}</strong>
                    <p>
                      {[
                        item.orb == null ? null : `${language === 'ru' ? 'Орб' : 'Orb'} ${item.orb.toFixed(1)}°`,
                        statusLabel(item.status, language),
                        item.period,
                      ].filter(Boolean).join(' · ')}
                    </p>
                    <p>{item.meaning}</p>
                  </article>
                ))}
              </div>
            </details>
          </div>
        ) : null}
      </div>

      <div style={{ height: 'calc(env(safe-area-inset-bottom, 0px) + 28px)' }} />
    </div>
  );
});

PersonalForecastScreen.displayName = 'PersonalForecastScreen';
