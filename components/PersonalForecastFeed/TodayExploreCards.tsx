import { useEffect, useMemo, useState } from 'react';
import { ChevronRight, Lock, Plus } from 'lucide-react';
import { ZodiacIcon } from '../icons/ZodiacIcon';
import { getZodiacSign } from '../../constants';
import { computeMatrix } from '../../lib/matrixOfDestiny';
import { getArcana } from '../../lib/matrixArcana';
import {
  buildExploreWheel,
  buildNatalTeaserFact,
  normalizeExploreSign,
  type ExplorePlanetKey,
} from '../../lib/todayExploreFacts';
import type { ChartListItem } from '../../services/storageService';
import { loadExploreCharts, peekExploreCharts } from './exploreCharts';
import type { NatalChartData } from '../../types';

type TodayExploreCardsProps = {
  language: 'ru' | 'en';
  userId: string;
  birthDate?: string | null;
  premium: boolean;
  onOpenNatal?: () => void;
  onOpenCompatibility?: () => void;
  onOpenMatrix?: () => void;
};

type SavedPerson = { name: string; sign: string };

const COPY = {
  ru: {
    heading: 'Узнать о себе больше',
    premium: 'NEBO+',
    natal: 'Натальная карта',
    natalFallback: 'Твой характер, сильные стороны и слабые места',
    compatibility: 'Совместимость',
    compatibilityEmpty: 'Сравни себя с кем угодно',
    and: 'и',
    matrix: 'Матрица судьбы',
    character: ['Твой', 'характер'],
  },
  en: {
    heading: 'Discover more about yourself',
    premium: 'NEBO+',
    natal: 'Birth chart',
    natalFallback: 'Your character, strengths and weak spots',
    compatibility: 'Compatibility',
    compatibilityEmpty: 'Compare yourself with anyone',
    and: 'and',
    matrix: 'Destiny matrix',
    character: ['Your', 'character'],
  },
} as const;

function firstSentence(text: string): string {
  const match = text.match(/^[^.!?]+[.!?]?/u);
  return (match ? match[0] : text).trim().replace(/[.!?]$/u, '');
}

function PremiumBadge({ label }: { label: string }) {
  return (
    <span className="today-explore-badge">
      <Lock aria-hidden="true" size={11} strokeWidth={2.2} />
      {label}
    </span>
  );
}

const SIGN_ORDER = [
  'Aries', 'Taurus', 'Gemini', 'Cancer', 'Leo', 'Virgo',
  'Libra', 'Scorpio', 'Sagittarius', 'Capricorn', 'Aquarius', 'Pisces',
];

function MiniWheel({
  chart,
  highlightSign,
  highlightPlanets,
}: {
  chart: NatalChartData;
  highlightSign: string | null;
  highlightPlanets: readonly ExplorePlanetKey[];
}) {
  const { points, ascendant } = buildExploreWheel(chart);
  const asc = ascendant ?? 0;
  const point = (longitude: number, radius: number) => {
    const angle = ((180 - (longitude - asc)) * Math.PI) / 180;
    return [60 + radius * Math.cos(angle), 60 - radius * Math.sin(angle)] as const;
  };
  const signIndex = highlightSign ? SIGN_ORDER.indexOf(highlightSign) : -1;
  let sector: string | null = null;
  if (signIndex >= 0) {
    const [ox1, oy1] = point(signIndex * 30, 56);
    const [ox2, oy2] = point(signIndex * 30 + 30, 56);
    const [ix1, iy1] = point(signIndex * 30 + 30, 42);
    const [ix2, iy2] = point(signIndex * 30, 42);
    sector = `M${ox1} ${oy1} A56 56 0 0 0 ${ox2} ${oy2} L${ix1} ${iy1} A42 42 0 0 1 ${ix2} ${iy2} Z`;
  }
  const highlighted = new Set(highlightPlanets);

  return (
    <svg className="today-explore-wheel" viewBox="0 0 120 120" aria-hidden="true">
      <circle cx="60" cy="60" r="56" className="is-ring" />
      <circle cx="60" cy="60" r="42" className="is-ring is-soft" />
      <circle cx="60" cy="60" r="18" className="is-core" />
      {sector ? <path d={sector} className="is-sector" /> : null}
      {SIGN_ORDER.map((sign, index) => {
        const [x1, y1] = point(index * 30, 42);
        const [x2, y2] = point(index * 30, 56);
        return <line key={sign} x1={x1} y1={y1} x2={x2} y2={y2} className="is-tick" />;
      })}
      {points.map(({ planet, longitude }) => {
        const [x, y] = point(longitude, 32);
        const strong = highlighted.size === 0 || highlighted.has(planet);
        const radius = planet === 'sun' ? 4.2 : planet === 'moon' ? 3.6 : strong ? 3.2 : 2.4;
        return <circle key={planet} cx={x} cy={y} r={radius} className={strong ? 'is-planet' : 'is-planet is-dim'} />;
      })}
    </svg>
  );
}

export function TodayExploreCards({
  language,
  userId,
  birthDate,
  premium,
  onOpenNatal,
  onOpenCompatibility,
  onOpenMatrix,
}: TodayExploreCardsProps) {
  const copy = COPY[language];
  const [charts, setCharts] = useState<ChartListItem[] | null>(() => peekExploreCharts(userId));

  useEffect(() => {
    let active = true;
    void loadExploreCharts(userId).then((list) => {
      if (active) setCharts(list);
    });
    return () => { active = false; };
  }, [userId]);

  const primary = charts?.find((chart) => chart.is_primary) ?? null;
  const chart = primary?.chart_data ?? null;
  const fact = useMemo(() => buildNatalTeaserFact(chart, language), [chart, language]);
  const ownSign = normalizeExploreSign(chart?.sun?.sign);
  const people = useMemo<SavedPerson[]>(() => (charts ?? [])
    .filter((item) => !item.is_primary && !item.archived_at && item.subject_type !== 'self')
    .flatMap((item) => {
      const sign = normalizeExploreSign(item.chart_data?.sun?.sign);
      return sign && item.name ? [{ name: item.name.trim(), sign }] : [];
    })
    .slice(0, 2), [charts]);
  const matrix = useMemo(
    () => (birthDate ? computeMatrix(birthDate, language) : null),
    [birthDate, language],
  );
  const characterArcana = matrix?.positions.find((position) => position.key === 'self')?.arcana ?? matrix?.center;
  const arcana = characterArcana ? getArcana(characterArcana) : null;

  if (!onOpenNatal && !onOpenCompatibility && !onOpenMatrix) return null;

  return (
    <nav className="today-explore" aria-label={copy.heading}>
      <h2 className="today-explore-heading">{copy.heading}</h2>
      <div className="today-explore-grid">
        {onOpenNatal ? (
          <button type="button" className="today-explore-card is-natal" onClick={onOpenNatal}>
            <span className="today-explore-copy">
              {!premium ? <PremiumBadge label={copy.premium} /> : null}
              <span className="today-explore-title">{copy.natal}</span>
              {fact ? (
                <>
                  <span className="today-explore-fact">{fact.headline}</span>
                  <span className="today-explore-caption">{fact.body}</span>
                </>
              ) : (
                <span className="today-explore-caption">{copy.natalFallback}</span>
              )}
            </span>
            {chart ? (
              <MiniWheel
                chart={chart}
                highlightSign={fact?.highlightSign ?? null}
                highlightPlanets={fact?.highlightPlanets ?? []}
              />
            ) : null}
            <ChevronRight className="today-explore-arrow" aria-hidden="true" size={18} strokeWidth={1.8} />
          </button>
        ) : null}

        {onOpenCompatibility ? (
          <button type="button" className="today-explore-card is-compatibility" onClick={onOpenCompatibility}>
            <span className="today-explore-signs" aria-hidden="true">
              {ownSign ? (
                <span className="today-explore-sign is-own"><ZodiacIcon sign={ownSign} size={20} strokeWidth={1.6} /></span>
              ) : null}
              {people.map((person) => (
                <span key={`${person.name}:${person.sign}`} className="today-explore-sign">
                  <ZodiacIcon sign={person.sign} size={20} strokeWidth={1.6} />
                </span>
              ))}
              {people.length === 0 ? (
                <span className="today-explore-sign is-add"><Plus size={18} strokeWidth={1.8} /></span>
              ) : null}
            </span>
            {ownSign && people.length ? (
              <span className="today-explore-pairs">
                {people.map((person) => (
                  <span key={`${person.name}:${person.sign}`} className="today-explore-pair">
                    {getZodiacSign(language, ownSign)} {copy.and} <b>{getZodiacSign(language, person.sign)}</b>
                  </span>
                ))}
              </span>
            ) : null}
            <span className="today-explore-copy is-bottom">
              {!premium ? <PremiumBadge label={copy.premium} /> : null}
              <span className="today-explore-title">{copy.compatibility}</span>
              <span className="today-explore-caption">
                {people.length
                  ? people.map((person) => person.name).join(` ${copy.and} `)
                  : copy.compatibilityEmpty}
              </span>
            </span>
            <ChevronRight className="today-explore-arrow" aria-hidden="true" size={18} strokeWidth={1.8} />
          </button>
        ) : null}

        {onOpenMatrix ? (
          <button type="button" className="today-explore-card is-matrix" onClick={onOpenMatrix}>
            {arcana ? (
              <>
                <span className="today-explore-number-row">
                  <span className="today-explore-number">{arcana.n}</span>
                  <span className="today-explore-number-label">{copy.character[0]}<br />{copy.character[1]}</span>
                </span>
                <span className="today-explore-keyword">
                  {language === 'ru' ? arcana.keyword : arcana.keywordEn}
                </span>
                <span className="today-explore-caption">
                  {firstSentence(language === 'ru' ? arcana.essence : arcana.essenceEn)}
                </span>
              </>
            ) : null}
            <span className="today-explore-copy is-bottom">
              <span className="today-explore-title">{copy.matrix}</span>
            </span>
            <ChevronRight className="today-explore-arrow" aria-hidden="true" size={18} strokeWidth={1.8} />
          </button>
        ) : null}
      </div>
    </nav>
  );
}
