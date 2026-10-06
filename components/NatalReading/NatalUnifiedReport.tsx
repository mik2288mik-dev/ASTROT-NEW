import React, { useEffect, useMemo, useState } from 'react';
import type { NatalChartData, UserProfile } from '../../types';
import type { NatalChartDataV2 } from '../../lib/natalChartV2Types';
import { buildNatalInterpretation } from '../../lib/natalInterpretation';
import type {
  NatalUnifiedReading,
  NatalUnifiedReadingTier,
} from '../../lib/natalReading/unifiedReading';
import {
  ensureNatalUnifiedReading,
  getNatalUnifiedReadingCached,
} from '../../services/natalUnifiedReadingService';
import styles from './NatalSection.module.css';
import { PremiumHook } from '../premium/PremiumHook';
import { SIGN_LOCATIVE_RU } from '../../lib/natalMoments';

/** Topic chips that scroll sideways; arrows at the edges show where there is more and move the row. */
function TopicNav({ topics, label }: { topics: ReadonlyArray<{ key: string; title: string }>; label: string }) {
  const rail = React.useRef<HTMLDivElement | null>(null);
  const [edges, setEdges] = useState({ left: false, right: false });
  const measure = React.useCallback(() => {
    const node = rail.current;
    if (!node) return;
    setEdges({ left: node.scrollLeft > 4, right: node.scrollLeft + node.clientWidth < node.scrollWidth - 4 });
  }, []);
  useEffect(() => {
    measure();
    window.addEventListener('resize', measure);
    return () => window.removeEventListener('resize', measure);
  }, [measure, topics.length]);
  const shift = (direction: 1 | -1) => rail.current?.scrollBy({ left: direction * Math.max(160, (rail.current?.clientWidth ?? 300) * 0.6), behavior: 'smooth' });
  return (
    <div className={styles.topicNav}>
      {edges.left ? <button type="button" className={`${styles.topicArrow} ${styles.topicArrowLeft}`} aria-label="Назад по темам" onClick={() => shift(-1)}>‹</button> : null}
      <div ref={rail} className={styles.topicRail} role="navigation" aria-label={label} onScroll={measure}>
        {topics.map((topic) => (
          <button
            key={topic.key}
            type="button"
            onClick={() => document.getElementById(`natal-topic-${topic.key}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' })}
          >
            {topic.title}
          </button>
        ))}
      </div>
      {edges.right ? <button type="button" className={`${styles.topicArrow} ${styles.topicArrowRight}`} aria-label="Дальше по темам" onClick={() => shift(1)}>›</button> : null}
    </div>
  );
}

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

/** «Венера в Скорпионе и Марс в Козероге — что это значит для тебя». */
function natalHookTitle(chart: NatalChartDataV2): string {
  const venus = SIGN_LOCATIVE_RU[chart.positions?.venus?.sign ?? ''];
  const mars = SIGN_LOCATIVE_RU[chart.positions?.mars?.sign ?? ''];
  return venus && mars
    ? `Венера в ${venus} и Марс в ${mars}, что это значит для тебя`
    : 'Дальше, весь рассказ о тебе и разбор по темам';
}

function errorText(language: 'ru' | 'en'): string {
  return language === 'ru'
    ? 'Разбор не загрузился. Попробуй ещё раз.'
    : 'The reading did not load. Try again.';
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
    return <section className={styles.state} role="status"><p>{language === 'ru' ? 'Загружаем разбор карты…' : 'Loading your reading…'}</p></section>;
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
      {mode === 'story' ? (
        <div className={styles.story}>
          {reading.story.map((block) => (
            <section key={block.id}>
              <p>{block.text}</p>
            </section>
          ))}
          {!isPremium && canPromotePremium ? (
            <PremiumHook
              title={natalHookTitle(v2)}
              items={interpretation.topics.slice(0, 5).map((topic) => (
                `${topic.title}, по ${topic.evidenceIds.length} ${topic.evidenceIds.length === 1 ? 'факту' : 'фактам'} твоей карты`
              ))}
              cta="Читать весь рассказ"
              note="Это продолжение того же рассказа, а не другой текст"
              onOpen={() => void requestPremium('deep_natal', {
                placement: 'deep_natal',
                featureKey: 'natal_deep',
                triggerType: 'locked_feature',
                returnView: 'chart',
              })}
            />
          ) : null}
        </div>
      ) : (
        <div className={styles.observations}>
          <TopicNav topics={reading.topics} label={language === 'ru' ? 'Темы' : 'Topics'} />
          {reading.topics.map((topic) => (
            <section key={topic.key} id={`natal-topic-${topic.key}`} className={styles.unifiedTopic}>
              <h2>{topic.title}</h2>
              {topic.blocks.map((block) => (
                <div key={block.id}>
                  <p>{block.text}</p>
                </div>
              ))}
            </section>
          ))}
        </div>
      )}
    </article>
  );
};
