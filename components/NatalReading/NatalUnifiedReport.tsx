import React, { useEffect, useMemo, useState } from 'react';
import type { NatalChartData, UserProfile } from '../../types';
import type { NatalChartDataV2 } from '../../lib/natalChartV2Types';
import { buildNatalInterpretation, type NatalInterpretation } from '../../lib/natalInterpretation';
import type {
  NatalUnifiedReading,
  NatalUnifiedReadingTier,
} from '../../lib/natalReading/unifiedReading';
import {
  ensureNatalUnifiedReading,
  getNatalUnifiedReadingCached,
} from '../../services/natalUnifiedReadingService';
import styles from './NatalSection.module.css';

type Props = {
  profile: UserProfile;
  chartData: NatalChartData;
  chartId?: number;
  mode: 'story' | 'topics';
  isPremium: boolean;
  savedPerson?: boolean;
  canPromotePremium?: boolean;
  requestPremium: (source?: string, payload?: Record<string, unknown>) => void | Promise<void>;
};

type LoadState = {
  identity: string;
  reading: NatalUnifiedReading | null;
  loading: boolean;
  error: string | null;
};

function canonical(chart: NatalChartData): NatalChartDataV2 | null {
  const value = chart as unknown as NatalChartDataV2;
  return value?.schemaVersion === 'natal-chart-data-v2' ? value : null;
}

function errorText(language: 'ru' | 'en'): string {
  return language === 'ru'
    ? 'Разбор не загрузился. Попробуй ещё раз.'
    : 'The reading did not load. Try again.';
}

function TechnicalEvidence(props: {
  interpretation: NatalInterpretation;
  meaningIds: readonly string[];
}) {
  const byId = useMemo(
    () => new Map(props.interpretation.meanings.map((meaning) => [meaning.id, meaning])),
    [props.interpretation],
  );
  const lines = props.meaningIds
    .map((id) => byId.get(id)?.technicalText)
    .filter((value): value is string => !!value);
  if (!lines.length) return null;
  return (
    <div className={styles.astroDetails}>
      {lines.map((line, index) => <p key={`${line}:${index}`}>{line}</p>)}
    </div>
  );
}

export const NatalUnifiedReport: React.FC<Props> = ({
  profile,
  chartData,
  chartId,
  mode,
  isPremium,
  savedPerson = false,
  canPromotePremium = true,
  requestPremium,
}) => {
  const language: 'ru' | 'en' = profile.language === 'en' ? 'en' : 'ru';
  const userId = profile.id ? String(profile.id) : '';
  const v2 = canonical(chartData);
  const interpretation = useMemo(
    () => v2 ? buildNatalInterpretation(v2, language) : null,
    [language, v2],
  );
  const [showAstrology, setShowAstrology] = useState(false);
  const [retryToken, setRetryToken] = useState(0);
  const tier: NatalUnifiedReadingTier = isPremium ? 'premium' : 'free';
  const identity = useMemo(
    () => JSON.stringify([
      userId,
      chartId ?? 'primary',
      language,
      chartData.calculationVersion || '',
      tier,
      retryToken,
    ]),
    [chartData.calculationVersion, chartId, language, retryToken, tier, userId],
  );
  const [state, setState] = useState<LoadState>({
    identity: '',
    reading: null,
    loading: false,
    error: null,
  });

  useEffect(() => {
    if (!v2 || !userId) {
      setState({ identity, reading: null, loading: false, error: errorText(language) });
      return;
    }
    let cancelled = false;
    const input = { userId, chartData, chartId, language, tier };
    const cached = getNatalUnifiedReadingCached(input);
    setState({
      identity,
      reading: cached,
      loading: !cached,
      error: null,
    });
    void ensureNatalUnifiedReading(input)
      .then((reading) => {
        if (!cancelled) setState({ identity, reading, loading: false, error: null });
      })
      .catch(() => {
        if (!cancelled) setState((current) => ({
          identity,
          reading: current.identity === identity ? current.reading : null,
          loading: false,
          error: errorText(language),
        }));
      });
    return () => { cancelled = true; };
  }, [chartData, chartId, identity, language, tier, userId, v2]);

  if (savedPerson && !isPremium) {
    return (
      <section className={styles.state}>
        <h2>{language === 'ru' ? 'Сохранённая карта' : 'Saved chart'}</h2>
        <p>{language === 'ru'
          ? 'Разбор сохранённых карт доступен с Premium.'
          : 'Saved-chart readings require Premium.'}</p>
        {canPromotePremium ? (
          <button
            type="button"
            onClick={() => void requestPremium('deep_natal', {
              placement: 'deep_natal',
              featureKey: 'natal_deep',
              triggerType: 'locked_feature',
              returnView: 'chart',
            })}
          >
            {language === 'ru' ? 'Открыть с Premium' : 'Open with Premium'}
          </button>
        ) : null}
      </section>
    );
  }

  if (!v2 || !interpretation) {
    return <section className={styles.state} role="alert"><p>{errorText(language)}</p></section>;
  }

  if (mode === 'topics' && !isPremium) {
    return (
      <article className={styles.overview}>
        <div className={styles.topics}>
          {interpretation.topics.map((topic) => (
            <button
              key={topic.key}
              type="button"
              onClick={() => {
                if (!canPromotePremium) return;
                void requestPremium('deep_natal', {
                  placement: 'deep_natal',
                  featureKey: 'natal_deep',
                  triggerType: 'locked_feature',
                  returnView: 'chart',
                });
              }}
            >
              <span>
                <strong>{topic.title}</strong>
                <small>
                  {language === 'ru'
                    ? `Основано на ${topic.evidenceIds.length} элементах твоей карты`
                    : `Based on ${topic.evidenceIds.length} chart factors`}
                </small>
              </span>
              <span aria-hidden="true">›</span>
            </button>
          ))}
        </div>
      </article>
    );
  }

  const reading = state.identity === identity ? state.reading : null;
  if (!reading && state.loading) {
    return <section className={styles.state} role="status"><p>{language === 'ru' ? 'Готовим разбор карты…' : 'Preparing your reading…'}</p></section>;
  }
  if (!reading) {
    return (
      <section className={styles.state} role="alert">
        <p>{state.error || errorText(language)}</p>
        <button type="button" onClick={() => setRetryToken((value) => value + 1)}>
          {language === 'ru' ? 'Попробовать снова' : 'Try again'}
        </button>
      </section>
    );
  }

  return (
    <article className={styles.overview}>
      <button
        type="button"
        className={styles.astroToggle}
        aria-pressed={showAstrology}
        onClick={() => setShowAstrology((value) => !value)}
      >
        {showAstrology
          ? (language === 'ru' ? 'Скрыть астрологию' : 'Hide astrology')
          : (language === 'ru' ? 'Показать астрологию' : 'Show astrology')}
      </button>

      {mode === 'story' ? (
        <div className={styles.story}>
          {reading.story.map((block) => (
            <section key={block.id}>
              <p>{block.text}</p>
              {showAstrology ? (
                <TechnicalEvidence interpretation={interpretation} meaningIds={block.meaningIds} />
              ) : null}
            </section>
          ))}
        </div>
      ) : (
        <div className={styles.observations}>
          {reading.topics.map((topic) => (
            <section key={topic.key} className={styles.unifiedTopic}>
              <h2>{topic.title}</h2>
              {topic.blocks.map((block) => (
                <div key={block.id}>
                  <p>{block.text}</p>
                  {showAstrology ? (
                    <TechnicalEvidence interpretation={interpretation} meaningIds={block.meaningIds} />
                  ) : null}
                </div>
              ))}
            </section>
          ))}
        </div>
      )}
    </article>
  );
};
